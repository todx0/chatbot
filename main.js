const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const {
	API_ID,
	API_HASH,
	SESSION,
	recapTextRequest,
} = require('./config');
const {
	writeToHistoryFile,
	clearHistory,
	getHistory
} = require('./app/history/history');
const {
	sleep,
	convertToImage,
	downloadFile
} = require('./app/helper');
const {
	generateGptResponse,
	createImageFromPrompt
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
async function getMessages({ limit, groupId }) {
	const messages = [];
	for await (const message of client.iterMessages(`-${groupId}`, { limit: limit })) {
		messages.push(`${message._sender.firstName}: ${message.message}`);
	}
	return messages.reverse();
}
function filterMessages(messages) {
	return messages.filter((message) => !message.includes('/recap') && message.length < 300);
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
	if (msgLimit > 300) {
		await sendGroupChatMessage('Max recap limit is 300: /recap 300', groupId);
		return;
	}
	const messages = await getMessages({ limit: msgLimit, groupId });
	const filteredMessages = filterMessages(messages);
	try {
		const response = await generateGptResponse(`${recapTextRequest} ${filteredMessages}`);
		await sendGroupChatMessage(response, groupId);
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
async function sendImage(groupId, imagePath) {
	try {
		await client.sendMessage(groupId, { file: imagePath });
	} catch (err) {
		console.error(err);
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
async function waitForTranscription(messageId, groupId) {
	try {
		let response = await transcribeAudioMessage(messageId, groupId);
		while (response.pending === true) {
			await sleep(5000);
			response = await transcribeAudioMessage(messageId, groupId);
		}
		return response.text;
	} catch (error) {
		// console.log(`Error: ${ error.message }`);
		return null;
	}
}
const processCommand = async (event) => {
	const { message } = event;
	if (!message) return;

	const groupId = message._chatPeer.channelId;
	if (message?.mediaUnread) {
		const { media } = message;
		if (media?.document?.mimeType === 'audio/ogg' || media?.document?.mimeType === 'video/mp4') {
			const transcribedAudio = await waitForTranscription(message.id, groupId);
			if (transcribedAudio) {
				await replyToMessage(transcribedAudio, message.id, groupId);
				return;
			}
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
