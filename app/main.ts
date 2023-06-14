import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { MessageIDLike } from 'telegram/define';
import {
	SendMessageParams,
	GetMessagesParams,
	mediaObject,
	CommandHandlers
} from './types.js';
import {
	config,
	historyFile,
	recapTextRequest,
	toxicRecapRequest,
	messageLimit,
	maxTokenLength
} from './config.js';
import {
	writeToHistoryFile,
	clearHistory,
	getHistory,
} from './history/history.js';
import {
	sleep,
	convertToImage,
	downloadFile,
	filterMessages,
	approximateTokenLength,
	convertFilteredMessagesToString,
	splitMessageInChunks
} from './helper.js';
import {
	generateGptResponse,
	createImageFromPrompt,
	generateGptResponseWithHistory,
	generateGptResponses,
	combineAnswers
} from './openai/api.js';

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
	try {
		const result = await client.invoke(sendMsg);
		return result;
	} catch (error) {
		console.error(`Error sending message: ${error}`);
	}
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
async function sendImage(groupId: string, imagePath: string): Promise<void> {
	try {
		await client.sendMessage(groupId, { file: imagePath });
	} catch (err) {
		console.error(err);
	}
}
async function getMessages({ limit, groupId }: GetMessagesParams): Promise<string[]> {
	const messages: string[] = [];
	for await (const message of client.iterMessages(`-${groupId}`, { limit })) {
		messages.push(`${message._sender.firstName}: ${message.message}`);
	}
	return messages.reverse();
}
async function handleClearCommand(groupId: string): Promise<void> {
	await Promise.all([
		clearHistory(historyFile),
	]);
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
			await writeToHistoryFile({ role: 'assistant', content: response }, historyFile);

			return response;
		}

		const filteredMessagesString = await convertFilteredMessagesToString(filteredMessages);
		const chunks = await splitMessageInChunks(filteredMessagesString);
		if (chunks.length === 1) {
			response = await generateGptResponse(`${recapTextRequest} ${chunks[0]}`);
			await sendGroupChatMessage(response, groupId);
			await writeToHistoryFile({ role: 'assistant', content: response }, historyFile);
			return response;
		}

		const responses = await generateGptResponses(recapTextRequest, chunks);
		const responsesCombined = await combineAnswers(responses);
		response = await generateGptResponse(`${toxicRecapRequest} ${responsesCombined}`);
		await sendGroupChatMessage(response, groupId);
		await writeToHistoryFile({ role: 'assistant', content: response }, historyFile);
		return response;
	} catch (error: any) {
		console.error('Error processing recap command:', error);
		await sendGroupChatMessage(error, groupId);
	}
}
async function handleQCommand(groupId: string, messageText: string): Promise<void> {
	const [, requestText] = messageText.split('/q ');
	try {
		const currentHistory = await getHistory(historyFile);
		const response = await generateGptResponseWithHistory({ conversationHistory: currentHistory, userRequest: requestText }); // `${currentHistory} \n ${qTextRequest} \n ${requestText}`
		await sendGroupChatMessage(response, groupId);
		await writeToHistoryFile({ role: 'user', content: requestText }, historyFile);
		await writeToHistoryFile({ role: 'assistant', content: response }, historyFile);
	} catch (error: any) {
		console.error('Error processing q command:', error);
		await sendGroupChatMessage(error, groupId);
	}
}
async function handleImgCommand(groupId: string, messageText: string): Promise<void> {
	const [, requestText] = messageText.split('/img ');
	try {
		const url = await createImageFromPrompt(requestText);
		await downloadConvertAndSend(url, groupId);
	} catch (error: any) {
		console.error('Error processing /img command:', error);
		await sendGroupChatMessage(error, groupId);
	}
}
async function handleImagineCommand(groupId: string, messageText: string): Promise<void> {
	const msgLimit = parseInt(messageText.split(' ')[1]);
	try {
		if (Number.isNaN(msgLimit)) {
			await sendGroupChatMessage('/imagine command requires a limit: /imagine 50', groupId);
			return;
		}
		if (msgLimit > 300) {
			await sendGroupChatMessage('Max imagine limit is 300: /imagine 300', groupId);
			return;
		}
		const messages = await getMessages({ limit: msgLimit, groupId });
		const filteredMessages = filterMessages(messages);
		const recapText = await generateGptResponse(`${recapTextRequest} ${filteredMessages}`);
		const url = await createImageFromPrompt(recapText);
		await downloadConvertAndSend(url, groupId);
	} catch (error: any) {
		console.error('Error processing /imagine command:', error);
		await sendGroupChatMessage(error, groupId);
	}
}
async function downloadConvertAndSend(url: string, groupId: string): Promise<void> {
	try {
		const buffer = await downloadFile(url);
		const imagePath = await convertToImage(buffer);
		await sendImage(groupId, imagePath);
	} catch (err) {
		console.error(err);
	}
}
async function transcribeAudioMessage(msgId: number, groupId: string): Promise<Api.messages.TranscribedAudio> {
	try {
		const transcribeAudio = new Api.messages.TranscribeAudio({
			peer: groupId,
			msgId,
		});
		const result = await client.invoke(transcribeAudio);
		return result;
	} catch (error: any) {
		console.error(`Error while transcribing message: ${error.message}`);
		return error.message;
	}
}
async function waitForTranscription(messageId: number, groupId: string): Promise<string | undefined | null> {
	try {
		let response = await transcribeAudioMessage(messageId, groupId);
		while (response.pending) {
			await sleep(5000);
			response = await transcribeAudioMessage(messageId, groupId);
		}
		if (response.text !== 'Error during transcription.') {
			return response.text;
		}
	} catch (error) {
		return null;
	}
}

function isMediaTranscribable(media: mediaObject): boolean {
	return (media?.document?.mimeType === 'audio/ogg' || media?.document?.mimeType === 'video/mp4');
}
function getCommand(messageText: string): string {
	const parts = messageText.split(' ');
	if (parts.length > 0 && parts[0] in {
		'/recap': true,
		'/q': true,
		'/clear': true,
		'/img': true,
		'/imagine': true
	}) {
		return parts[0];
	}
	return '';
}
async function checkIfOwnAndReturn(messageId: number, groupId: string): Promise<string> {
	const messages = await client.getMessages(groupId, { ids: messageId });
	const senderId = String(messages[0]._senderId);
	if (senderId === String(BOT_ID)) {
		return senderId;
	}
	return '';
}
const processCommand = async (event: any) => {
	const { message } = event;
	if (!message) return;
	const groupId = message._chatPeer.channelId;

	if (message?.originalArgs.mentioned) {
		const msgId = event.message.replyTo.replyToMsgId;
		const messageResponse = await checkIfOwnAndReturn(msgId, groupId);
		if (messageResponse) {
			await writeToHistoryFile({ role: 'assistant', content: messageResponse }, historyFile);
			const currentHistory = await getHistory(historyFile);
			const replyTo = message.originalArgs.message;
			const gptReply = await generateGptResponseWithHistory({ conversationHistory: currentHistory, userRequest: replyTo });
			await replyToMessage(gptReply, message.id, groupId);

			await writeToHistoryFile({ role: 'user', content: replyTo }, historyFile);
			await writeToHistoryFile({ role: 'assistant', content: gptReply }, historyFile);
			return;
		}
	}
	if (message?.mediaUnread && isMediaTranscribable(message.media)) {
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
	const command = getCommand(messageText);
	const handler = commandHandlers[command];
	if (handler) {
		await handler(groupId, messageText);
	}
};

(async () => {
	await client.connect();
	client.addEventHandler(processCommand);
})();
