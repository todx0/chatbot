import { Api } from 'telegram';
import {
	SendMessageParams,
	GetMessagesParams,
} from './types';
import {
	recapTextRequest,
	toxicRecapRequest,
	messageLimit,
	maxTokenLength,
} from './config';
import {
	retry,
	convertToImage,
	downloadFile,
	filterMessages,
	approximateTokenLength,
	splitMessageInChunks,
	clearMessagesTable,
} from './helper';
import {
	generateGptResponse,
	createImageFromPrompt,
	generateGptRespWithHistory,
	generateGptResponses,
	combineAnswers
} from './modules/openai/api';
import client from './main';

// use this workaround instead destructuring config because 'bun test' fails otherwise.
const { BOT_ID } = Bun.env;

export async function sendMessage(obj: SendMessageParams): Promise<Api.TypeUpdates | undefined> {
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
export async function sendImage(groupId: string, imagePath: string): Promise<Api.Message> {
	return client.sendMessage(groupId, { file: imagePath });
}
export async function getMessages({ limit, groupId }: GetMessagesParams): Promise<string[]> {
	const messages: string[] = [];
	for await (const message of client.iterMessages(`-${groupId}`, { limit })) {
		messages.push(`${message._sender.firstName}: ${message.message}`);
	}
	return messages.reverse();
}
export async function handleClearCommand(groupId: string): Promise<void> {
	await clearMessagesTable();
	await sendMessage({
		peer: groupId,
		message: 'History cleared',
	});
}
export async function handleRecapCommand(groupId: string, messageText: string): Promise<void> {
	const msgLimit = parseInt(messageText.split(' ')[1]);

	if (Number.isNaN(msgLimit)) {
	  await sendMessage({ peer: groupId, message: '/recap command requires a limit: /recap 50' });
	  return;
	}

	if (msgLimit > messageLimit) {
	  await sendMessage({ peer: groupId, message: 'Max recap limit is 500: /recap 500' });
	  return;
	}

	try {
	  const messages = await getMessages({ limit: msgLimit, groupId });
	  const filteredMessages = await filterMessages(messages);
	  let response: string;

	  const messagesLength = await approximateTokenLength(filteredMessages);

	  if (messagesLength <= maxTokenLength) {
			const messageString = Array.isArray(filteredMessages) ? filteredMessages.join(' ') : filteredMessages;
			response = await generateGptResponse(`${recapTextRequest} ${messageString}`);
	  } else {
			const chunks = await splitMessageInChunks(filteredMessages.toString());
			if (chunks.length === 1) {
				response = await generateGptResponse(`${recapTextRequest} ${chunks[0]}`);
			} else {
				const responses = await generateGptResponses(recapTextRequest, chunks);
				const responsesCombined = await combineAnswers(responses);
				response = await generateGptResponse(`${toxicRecapRequest} ${responsesCombined}`);
			}
	  }
	  await sendMessage({ peer: groupId, message: response });
	} catch (error) {
	  await sendMessage({ peer: groupId, message: String(error) });
	  throw error;
	}
}
export async function handleQCommand(groupId: string, messageText: string): Promise<void> {
	const [, requestText] = messageText.split('/q ');
	try {
		const response = await generateGptRespWithHistory(requestText);
		await sendMessage({
			peer: groupId,
			message: response
		});
	} catch (error) {
		await sendMessage({
			peer: groupId,
			message: String(error)
		});
		throw error;
	}
}
export async function handleImgCommand(groupId: string, messageText: string): Promise<void> {
	const [, requestText] = messageText.split('/img ');

	if (!requestText) {
		await sendMessage({
			peer: groupId,
			message: '/img command requires a prompt'
		});
		return;
	}
	try {
		const url = await createImageFromPrompt(requestText);
		if (!url.includes('https://')) return;
		await downloadAndSendImageFromUrl(url, groupId);
	} catch (error) {
		await sendMessage({
			peer: groupId,
			message: String(error)
		});
		throw error;
	}
}
export async function handleImagineCommand(groupId: string, messageText: string): Promise<void> {
	const msgLimit = parseInt(messageText.split(' ')[1]);
	if (Number.isNaN(msgLimit)) {
		await sendMessage({
			peer: groupId,
			message: '/imagine command requires a limit: /imagine 50'
		});
		return;
	}
	if (msgLimit > 300) {
		await sendMessage({
			peer: groupId,
			message: 'Max imagine limit is 300: /imagine 300'
		});
		return;
	}
	try {
		const messages = await getMessages({ limit: msgLimit, groupId });
		const filteredMessages = filterMessages(messages);
		const recapText = await generateGptResponse(`${recapTextRequest} ${filteredMessages}`);
		const url = await createImageFromPrompt(recapText);
		await downloadAndSendImageFromUrl(url, groupId);
	} catch (error) {
		await sendMessage({
			peer: groupId,
			message: String(error)
		});
		throw error;
	}
}
export async function downloadAndSendImageFromUrl(url: string, groupId: string): Promise<void> {
	const buffer = await downloadFile(url);
	const imagePath = await convertToImage(buffer);
	await sendImage(groupId, imagePath);
}
export async function transcribeAudioMessage(msgId: number, groupId: string): Promise<Api.messages.TranscribedAudio> {
	const transcribeAudio = new Api.messages.TranscribeAudio({
		peer: groupId,
		msgId,
	});
	const result = await client.invoke(transcribeAudio);
	return result;
}
export async function waitForTranscription(messageId: number, groupId: string): Promise<string> {
	const response = await retry(() => transcribeAudioMessage(messageId, groupId), 3);
	if (response.text !== 'Error during transcription.') {
		return response.text;
	}
	return '';
}
export async function getMessageContentById(messageId: number, groupId: string): Promise<any> {
	const message = await client.getMessages(groupId, { ids: messageId });
	return message[0].message;
}
export async function checkReplyIdIsBotId(messageId: number, groupId: string): Promise<boolean> {
	const messages = await client.getMessages(groupId, { ids: messageId });
	const senderId = String(messages[0]._senderId);
	if (senderId === String(BOT_ID)) {
		return true;
	}
	return false;
}
export async function processMessage(userRequest: string, groupId: string, messageId: number): Promise<void> {
	const gptReply = await generateGptRespWithHistory(userRequest);
	await sendMessage({
		peer: groupId,
		message: gptReply,
		replyToMsgId: messageId,
		silent: true
	});
}
