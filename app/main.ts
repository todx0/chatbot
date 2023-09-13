import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { MessageIDLike } from 'telegram/define';
import {
	SendMessageParams,
	GetMessagesParams,
	CommandHandlers,
} from './types';
import {
	config,
	recapTextRequest,
	toxicRecapRequest,
	messageLimit,
	maxTokenLength,
	chatCommands,
	botUsername,
} from './config';
import {
	retry,
	convertToImage,
	downloadFile,
	filterMessages,
	approximateTokenLength,
	splitMessageInChunks,
	getCommand,
	messageNotSeen,
	shouldSendRandomReply,
	somebodyMentioned,
	shouldTranscribeMedia,
	createMessagesTable,
	clearMessagesTable,
} from './helper';
import {
	generateGptResponse,
	createImageFromPrompt,
	generateGptRespWithHistory,
	generateGptResponses,
	combineAnswers
} from './openai/api';

const {
	SESSION,
	API_ID,
	API_HASH,
	BOT_ID,
} = config;

const client = new TelegramClient(new StringSession(SESSION), +API_ID, API_HASH, {
	connectionRetries: 5,
});
async function sendMessage(obj: SendMessageParams): Promise<Api.TypeUpdates | undefined> {
	const {
		peer, message, replyToMsgId, silent
	} = obj;
	const sendMsg = new Api.messages.SendMessage({
		peer,
		message,
		replyToMsgId,
		silent
	});
	const result = await client.invoke(sendMsg);
	return result;
}
async function sendGroupChatMessage(messageText: string, groupId: string): Promise<Api.TypeUpdates | undefined> {
	const message = await sendMessage({
		peer: groupId,
		message: messageText,
		silent: false
	});
	return message;
}
async function replyToMessage(messageText: string, replyToMsgId: MessageIDLike, groupId: string): Promise<Api.TypeUpdates | undefined> {
	const message = await sendMessage({
		peer: groupId,
		message: messageText,
		replyToMsgId,
		silent: true
	});
	return message;
}
async function sendImage(groupId: string, imagePath: string): Promise<Api.Message> {
	return client.sendMessage(groupId, { file: imagePath });
}
async function getMessages({ limit, groupId }: GetMessagesParams): Promise<string[]> {
	const messages: string[] = [];
	for await (const message of client.iterMessages(`-${groupId}`, { limit })) {
		messages.push(`${message._sender.firstName}: ${message.message}`);
	}
	return messages.reverse();
}
async function handleClearCommand(groupId: string): Promise<void> {
	await clearMessagesTable();
	await sendGroupChatMessage('History cleared', groupId);
}
async function handleRecapCommand(groupId: string, messageText: string): Promise<void | string> {
	const msgLimit = parseInt(messageText.split(' ')[1]);

	if (Number.isNaN(msgLimit)) {
		await sendGroupChatMessage('/recap command requires a limit: /recap 50', groupId);
		return;
	}
	if (msgLimit > messageLimit) {
		await sendGroupChatMessage('Max recap limit is 500: /recap 500', groupId);
		return;
	}
	const messages = await getMessages({ limit: msgLimit, groupId });
	const filteredMessages = await filterMessages(messages);
	try {
		let response;
		const messagesLength = await approximateTokenLength(filteredMessages);

		if (messagesLength <= maxTokenLength) {
			const messageString = Array.isArray(filteredMessages)
				? filteredMessages.join(' ')
				: filteredMessages;
			response = await generateGptResponse(`${recapTextRequest} ${messageString}`);
			await sendGroupChatMessage(response, groupId);
			return response;
		}

		const chunks = await splitMessageInChunks(filteredMessages.toString());
		if (chunks.length === 1) {
			response = await generateGptResponse(`${recapTextRequest} ${chunks[0]}`);
			await sendGroupChatMessage(response, groupId);
			return response;
		}

		const responses = await generateGptResponses(recapTextRequest, chunks);
		const responsesCombined = await combineAnswers(responses);
		response = await generateGptResponse(`${toxicRecapRequest} ${responsesCombined}`);
		await sendGroupChatMessage(response, groupId);
		return response;
	} catch (error) {
		await sendGroupChatMessage(error, groupId);
		throw error;
	}
}
async function handleQCommand(groupId: string, messageText: string): Promise<void> {
	const [, requestText] = messageText.split('/q ');
	try {
		const response = await generateGptRespWithHistory(requestText);
		await sendGroupChatMessage(response, groupId);
	} catch (error) {
		await sendGroupChatMessage(error, groupId);
		throw error;
	}
}
async function handleImgCommand(groupId: string, messageText: string): Promise<void> {
	const [, requestText] = messageText.split('/img ');

	if (!requestText) {
		await sendGroupChatMessage('/img command requires a prompt', groupId);
		return;
	}
	try {
		const url = await createImageFromPrompt(requestText);
		if (!url.includes('https://')) return;
		await downloadAndSendImageFromUrl(url, groupId);
	} catch (error) {
		await sendGroupChatMessage(error, groupId);
		throw error;
	}
}
async function handleImagineCommand(groupId: string, messageText: string): Promise<void> {
	const msgLimit = parseInt(messageText.split(' ')[1]);
	if (Number.isNaN(msgLimit)) {
		await sendGroupChatMessage('/imagine command requires a limit: /imagine 50', groupId);
		return;
	}
	if (msgLimit > 300) {
		await sendGroupChatMessage('Max imagine limit is 300: /imagine 300', groupId);
		return;
	}
	try {
		const messages = await getMessages({ limit: msgLimit, groupId });
		const filteredMessages = filterMessages(messages);
		const recapText = await generateGptResponse(`${recapTextRequest} ${filteredMessages}`);
		const url = await createImageFromPrompt(recapText);
		await downloadAndSendImageFromUrl(url, groupId);
	} catch (error) {
		await sendGroupChatMessage(error, groupId);
		throw error;
	}
}
async function downloadAndSendImageFromUrl(url: string, groupId: string): Promise<void> {
	const buffer = await downloadFile(url);
	const imagePath = await convertToImage(buffer);
	await sendImage(groupId, imagePath);
}
async function transcribeAudioMessage(msgId: number, groupId: string): Promise<Api.messages.TranscribedAudio> {
	const transcribeAudio = new Api.messages.TranscribeAudio({
		peer: groupId,
		msgId,
	});
	const result = await client.invoke(transcribeAudio);
	return result;
}
async function waitForTranscription(messageId: number, groupId: string): Promise<string> {
	const response = await retry(() => transcribeAudioMessage(messageId, groupId), 3);
	if (response.text !== 'Error during transcription.') {
		return response.text;
	}
	return '';
}
async function getMessageContentById(messageId: number, groupId: string): Promise<any> {
	const message = await client.getMessages(groupId, { ids: messageId });
	return message[0].message;
}
async function checkReplyIdIsBotId(messageId: number, groupId: string): Promise<boolean> {
	const messages = await client.getMessages(groupId, { ids: messageId });
	const senderId = String(messages[0]._senderId);
	if (senderId === String(BOT_ID)) {
		return true;
	}
	return false;
}
async function processMessage(userRequest: string, groupId: string, messageId: number): Promise<void> {
	const gptReply = await generateGptRespWithHistory(userRequest);
	await replyToMessage(gptReply, messageId, groupId);
}

const processCommand = async (event: any) => {
	const { message } = event;

	if (!message) return;
	if (!messageNotSeen(message)) return;

	const groupId = message._chatPeer.channelId;
	const replyTo = message.message;

	if (shouldSendRandomReply(message)) {
		await processMessage(replyTo, groupId, message.id);
		return;
	}

	if (somebodyMentioned(message)) {
		const { replyToMsgId } = event.message.replyTo;
		const isBotMentioned: boolean = await checkReplyIdIsBotId(replyToMsgId, groupId);
		const isBotCalled: boolean = replyTo.includes(botUsername);

		if (isBotMentioned) {
			await processMessage(replyTo, groupId, message.id);
			return;
		}

		if (isBotCalled) {
			const messageContent = await getMessageContentById(replyToMsgId, groupId);
			await processMessage(messageContent, groupId, replyToMsgId);
			return;
		}
	}

	if (shouldTranscribeMedia(message)) {
		const transcribedAudio = await waitForTranscription(message.id, groupId);
		if (transcribedAudio) {
			await replyToMessage(transcribedAudio, message.id, groupId);
			return;
		}
	}

	const commandHandlers: CommandHandlers = {
		'/recap': handleRecapCommand,
		'/q': handleQCommand,
		'/clear': handleClearCommand,
		'/img': handleImgCommand,
		'/imagine': handleImagineCommand,
	};

	const messageText = message?.message;
	const command = getCommand(messageText, chatCommands);
	const handler = commandHandlers[command];
	if (handler) {
		await handler(groupId, messageText);
	}
};

(async () => {
	await createMessagesTable();
	await client.connect();
	client.addEventHandler(processCommand);
})();
