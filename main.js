const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const fs = require('fs');
const {
	API_ID,
	API_HASH,
	SESSION,
	openAiTextRequest,
	openai
} = require('./config');
const history = './history.txt';

const client = new TelegramClient(new StringSession(SESSION), +API_ID, API_HASH, {
	connectionRetries: 5,
});

async function writeToHistoryFile(line) {
	const fileName = history;
	const maxLines = 10;
	try {
		const oldContent = fs.readFileSync(fileName, { encoding: 'utf-8' }).split('\n');
		const newContent = [...oldContent.slice(-(maxLines - 1)), line];
		fs.writeFileSync(fileName, newContent.join('\n'));
	} catch (error) {
		console.error(`Error while writing to file: ${error.message}`);
	}
}

async function readHistoryFile(fileName) {
	try {
		const content = fs.readFileSync(fileName, { encoding: 'utf-8' });
		return content;
	} catch (error) {
		console.error(`Error while reading file "${fileName}": ${error.message}`);
		return null;
	}
}

async function clearHistory() {
	fs.truncate(history, 0, () => { console.log('History cleared'); });
}

async function getHistory() {
	const fileContent = await readHistoryFile(history);
	if (fileContent) return `Your previous answers are: ${fileContent}`;
	return '';
}

async function sendMessage(peer, messageText, replyToMsgId) {
	const sendMsg = new Api.messages.SendMessage({
		peer,
		message: messageText,
		replyToMsgId
	});
	try {
		const result = await client.invoke(sendMsg);
		return result;
	} catch (error) {
		console.error(`Error sending message: ${error}`);
	}
}

async function sendGroupChatMessage(messageText, groupId) {
	const message = await sendMessage(groupId, messageText, null);
	return message;
}

async function replyToMessage(messageText, replyToMsgId, groupId) {
	const message = await sendMessage(groupId, messageText, replyToMsgId);
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
		return null;
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

async function generateGptResponse(messages) {
	try {
		const response = await openai.createChatCompletion({
			model: 'gpt-3.5-turbo',
			messages: [
				{
					role: 'user',
					content: `${messages}`
				}
			]
		});

		return response.data.choices[0].message.content;
	} catch (error) {
		// throw new Error(error.response.data.error.message);
		return error.response.data.error.message;
	}
}

async function processCommand(event) {
	const { message } = event;
	console.log(message);
	// if (!message) return;
	/* 	const groupId = message._chatPeer.channelId;
		if (message?.media?.document?.mimeType === 'audio/ogg') {
			console.log('msgid=>>', message.id);
			const transcribedAudioText = await transcribeAudioMessage(message.id, groupId);
			await replyToMessage(transcribedAudioText, message.id, groupId);
		} else if (message?.message) {
			const command = getCommand(message.message);
			if (command === '/recap') {
				await handleRecapCommand(groupId, message.message);
			} else if (command === '/q') {
				await handleQCommand(groupId, message.message);
			} else if (command === '/clear') {
				await handleClearCommand(groupId);
			}
		} */
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
		const response = await generateGptResponse(`${openAiTextRequest} ${filteredMessages}`);
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

function getCommand(messageText) {
	const parts = messageText.split(' ');

	if (parts.length > 0 && parts[0] in { '/recap': true, '/q': true, '/clear': true }) {
		return parts[0];
	}

	return null;
}

module.exports = (async () => {
	await client.connect();
	client.addEventHandler(processCommand);
})();
