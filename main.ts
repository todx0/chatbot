import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import {
	API_ID,
	API_HASH,
	SESSION,
	recapTextRequest,
	toxicRecapRequest,
	BOT_ID,
} from './config.js';
import {
	writeToHistoryFile,
	clearHistory,
	getHistory,
	qHistory,
	replHistory
} from './app/history/history.js';
import {
	sleep,
	convertToImage,
	downloadFile,
	filterMessages,
	approximateTokenLength,
	convertFilteredMessagesToString,
	splitMessageInChunks
} from './app/helper.js';
import {
	generateGptResponse,
	createImageFromPrompt,
	generateGptResponses,
	combineAnswers
} from './app/openai/api.js';


const client = new TelegramClient(new StringSession(SESSION), +API_ID!, API_HASH!, {
	connectionRetries: 5,
});
interface SendMessageParams {
	peer: string,
	message: string,
	replyToMsgId?: any,
	silent?: boolean,
}
async function sendMessage(obj: SendMessageParams) {
	const {
		peer, message, replyToMsgId, silent
	} = obj;
	const sendMsg = new Api.messages.SendMessage({
		peer: peer,
		message: message,
		replyToMsgId: replyToMsgId,
		silent: silent
	});
	try {
		const result = await client.invoke(sendMsg);
		return result;
	} catch (error) {
		console.error(`Error sending message: ${error}`);
	}
}
//!!
async function sendGroupChatMessage(messageText: string, groupId: string) {
	const message = await sendMessage({
		peer: groupId,
		message: messageText,
		silent: false
	});
	return message;
}
async function replyToMessage(messageText: string, replyToMsgId: string, groupId: string) {
	const message = await sendMessage({
		peer: groupId,
		message: messageText,
		replyToMsgId: replyToMsgId,
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
interface GetMessagesParams {
	limit: number;
	groupId: string;
}
async function getMessages({ limit, groupId }: GetMessagesParams): Promise<string[]> {
	const messages: string[] = [];
	for await (const message of client.iterMessages(`-${groupId}`, { limit: limit })) {
		messages.push(`${message._sender.firstName}: ${message.message}`);
	}
	return messages.reverse();
}
async function handleClearCommand(groupId: string): Promise<void> {
	await Promise.all([
		clearHistory(qHistory),
		clearHistory(replHistory)
	]);
	await sendGroupChatMessage('History cleared', groupId);
}
async function handleRecapCommand(groupId: string, messageText: string): Promise<void | string> {
	const msgLimit = parseInt(messageText.split(' ')[1]);

	if (Number.isNaN(msgLimit)) {
		await sendGroupChatMessage('/recap command requires a limit: /recap 50', groupId);
		return;
	}
	if (msgLimit > 500) {
		await sendGroupChatMessage('Max recap limit is 500: /recap 500', groupId);
		return;
	}
	const messages = await getMessages({ limit: msgLimit, groupId });
	const filteredMessages = await filterMessages(messages);
	try {
		let response;
		const messagesLength = await approximateTokenLength(filteredMessages);
		const maxLength = 4096;

		if (messagesLength <= maxLength) {
			const messageString = Array.isArray(filteredMessages)
				? filteredMessages.join(' ')
				: filteredMessages;
			response = await generateGptResponse(`${recapTextRequest} ${messageString}`);
			await sendGroupChatMessage(response, groupId);
			return response;
		}

		const filteredMessagesString = await convertFilteredMessagesToString(filteredMessages);
		const chunks = await splitMessageInChunks(filteredMessagesString);
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
	} catch (error: any) {
		console.error('Error processing recap command:', error);
		await sendGroupChatMessage(error, groupId);
	}
}
async function handleQCommand(groupId: string, messageText: string): Promise<void> {
	const requestText = messageText.split('/q ')[1];
	try {
		const currentHistory = await getHistory(qHistory);
		const response = await generateGptResponse(`${requestText}. \n Анализируй предыдущие ответы и вопросы (игнорируй если ничего нет): ${currentHistory} \n отвечай без Q: и A:`);
		await sendGroupChatMessage(response, groupId);
		await writeToHistoryFile(`Q: ${requestText}`, qHistory);
		await writeToHistoryFile(`A: ${response}`, qHistory);
	} catch (error: any) {
		console.error('Error processing q command:', error);
		await sendGroupChatMessage(error, groupId);
	}
}
async function handleImgCommand(groupId: string, messageText: string): Promise<void> {
	const requestText = messageText.split('/img ')[1];
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
// !! any
async function transcribeAudioMessage(msgId: number, groupId: string): Promise<any> {
	try {
		const transcribeAudio = new Api.messages.TranscribeAudio({
			peer: groupId,
			msgId: msgId,
		});
		const result = await client.invoke(transcribeAudio);
		return result;
	} catch (error: any) {
		console.error(`Error while transcribing message: ${error.message}`);
		return error.message;
	}
}
async function waitForTranscription(messageId: number, groupId: string) {
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
		// console.log(`Error: ${ error.message }`);
		return null;
	}
}
interface mediaObject {
	document: {
		mimeType: string
	}
}
function isMediaTranscribable(media: mediaObject) {
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
	return "";
}
async function checkIfOwnAndReturn(messageId: number, groupId: string) {
	const message: any[] = await client.getMessages(groupId, { ids: messageId });
	console.log('->', typeof message)
	if (+message[0]._senderId === +BOT_ID!) {
		return message[0].message;
	}
	return "";
}
const processCommand = async (event: any) => {
	const { message } = event;
	if (!message) return;
	const groupId = message._chatPeer.channelId;

	if (message?.originalArgs.mentioned) {
		const msgId = event.message.replyTo.replyToMsgId;
		const messageResponse = await checkIfOwnAndReturn(msgId, groupId);
		if (messageResponse) {
			const currentHistory = await getHistory(replHistory);
			const replyTo = message.originalArgs.message;
			const gptRequest = `This message is yours: ${messageResponse}. \n This was a person's reply to it: ${replyTo}. \n Reply to person's message in his language in a little of sarcastic way and sound that you are annoyed. Whole conversation: ${currentHistory}`;
			const gptReply = await generateGptResponse(gptRequest);
			await replyToMessage(gptReply, message.id, groupId);
			await writeToHistoryFile(`User: ${replyTo}`, replHistory);
			await writeToHistoryFile(`You: ${gptReply}`, replHistory);
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
	interface CommandHandlers {
		[command: string]: (groupId: string, messageText: string) => Promise<void | string>;
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
