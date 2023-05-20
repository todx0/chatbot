const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const {
	API_ID,
	API_HASH,
	SESSION,
	recapTextRequest,
	BOT_ID
} = require('./config');
const {
	writeToHistoryFile,
	clearHistory,
	getHistory
} = require('./app/history/history');
const {
	sleep,
	convertToImage,
	downloadFile,
	filterMessages,
	approximateTokenLength,
	convertFilteredMessagesToString,
	splitMessageInChunks
} = require('./app/helper');
const {
	generateGptResponse,
	createImageFromPrompt,
	generateGptResponses,
	combineAnswers
} = require('./app/openai/api');

const client = new TelegramClient(new StringSession(SESSION), +API_ID, API_HASH, {
	connectionRetries: 5,
});

async function sendMessage(obj) {
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
async function sendGroupChatMessage(messageText, groupId) {
	const message = await sendMessage({
		peer: groupId,
		message: messageText,
		silent: false
	});
	return message;
}
async function replyToMessage(messageText, replyToMsgId, groupId) {
	const message = await sendMessage({
		peer: groupId,
		message: messageText,
		replyToMsgId: replyToMsgId,
		silent: true
	});
	return message;
}
async function sendImage(groupId, imagePath) {
	try {
		await client.sendMessage(groupId, { file: imagePath });
	} catch (err) {
		console.error(err);
	}
}
async function getMessages({ limit, groupId }) {
	const messages = [];
	for await (const message of client.iterMessages(`-${groupId}`, { limit: limit })) {
		messages.push(`${message._sender.firstName}: ${message.message}`);
	}
	return messages.reverse();
}
async function handleClearCommand(groupId) {
	await clearHistory();
	await sendGroupChatMessage('History cleared', groupId);
}
async function handleRecapCommand(groupId, messageText) {
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
		response = await generateGptResponse(`There are few recaps of the conversation. Combine them and do a detailed recap in russian language in a little of sarcastic way and sound that you are annoyed: ${responsesCombined}`);
		await sendGroupChatMessage(response, groupId);
		return response;
	} catch (error) {
		console.error('Error processing recap command:', error);
		await sendGroupChatMessage(error, groupId);
	}
}
async function handleQCommand(groupId, messageText) {
	const requestText = messageText.split('/q ')[1];
	try {
		const currentHistory = await getHistory();
		const response = await generateGptResponse(`${requestText} ${currentHistory}`);
		await sendGroupChatMessage(response, groupId);
		await writeToHistoryFile(response);
	} catch (error) {
		console.error('Error processing q command:', error);
		await sendGroupChatMessage(error, groupId);
	}
}
async function handleImgCommand(groupId, messageText) {
	const requestText = messageText.split('/img ')[1];
	try {
		const url = await createImageFromPrompt(requestText);
		await downloadConvertAndSend(url, groupId);
	} catch (error) {
		console.error('Error processing /img command:', error);
		await sendGroupChatMessage(error, groupId);
	}
}
async function handleImagineCommand(groupId, messageText) {
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
	} catch (error) {
		console.error('Error processing /imagine command:', error);
		await sendGroupChatMessage(error, groupId);
	}
}
async function downloadConvertAndSend(url, groupId) {
	try {
		const buffer = await downloadFile(url);
		const imagePath = await convertToImage(buffer);
		await sendImage(groupId, imagePath);
	} catch (err) {
		console.error(err);
	}
}
async function transcribeAudioMessage(msgId, groupId) {
	try {
		const transcribeAudio = new Api.messages.TranscribeAudio({
			peer: groupId,
			msgId: msgId,
		});
		const result = await client.invoke(transcribeAudio);
		return result;
	} catch (error) {
		console.error(`Error while transcribing message: ${error.message}`);
		return error.message;
	}
}
async function waitForTranscription(messageId, groupId) {
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
function isMediaTranscribable(media) {
	return (media?.document?.mimeType === 'audio/ogg' || media?.document?.mimeType === 'video/mp4');
}
function getCommand(messageText) {
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
	return null;
}
async function checkIfOwnAndReturn(messageId, groupId) {
	const message = await client.getMessages(groupId, { ids: messageId });
	if (+message[0]._senderId === +BOT_ID) {
		return message[0].message;
	}
	return null;
}
const processCommand = async (event) => {
	const { message } = event;
	if (!message) return;
	const groupId = message._chatPeer.channelId;

	if (message?.originalArgs.mentioned) {
		const msgId = event.message.replyTo.replyToMsgId;
		const messageResponse = await checkIfOwnAndReturn(msgId, groupId);
		if (messageResponse) {
			const replyTo = message.originalArgs.message;
			const gptRequest = `This message is yours: ${messageResponse}. \n This was a person's reply to it: ${replyTo}. \n Reply to person's message in his language in a little of sarcastic way and sound that you are annoyed`;
			const gptReply = await generateGptResponse(gptRequest);
			await replyToMessage(gptReply, message.id, groupId);
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
	const commandHandlers = {
		'/recap': handleRecapCommand,
		'/q': handleQCommand,
		'/clear': handleClearCommand,
		'/img': handleImgCommand,
		'/imagine': handleImagineCommand
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
