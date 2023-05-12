const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const {
	API_ID,
	API_HASH,
	SESSION,
	openAiTextRequest,
	openai
} = require('./config');

const client = new TelegramClient(new StringSession(SESSION), +API_ID, API_HASH, {
	connectionRetries: 5,
});

const history = [];
function getHistory() {
	if (history.length) return `History of your responses:\n${history.join('\n')}`;
}

function updateHistory(array, newElement) {
	const updatedHistory = [...array];

	if (updatedHistory.length < 30) {
		updatedHistory.push(newElement);
	} else {
		updatedHistory.splice(-1, 1, newElement);
	}
	return updatedHistory;
}
async function sendGroupChatMessage(messageText, groupId) {
	try {
		const sendMessage = new Api.messages.SendMessage({
			peer: groupId,
			message: messageText,
		});

		const result = await client.invoke(sendMessage);

		return result;
	} catch (error) {
		console.error('Error sending group chat message:', error);
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

	if (!message || !message.message) {
		return;
	}

	const groupId = message._chatPeer.channelId;
	const command = getCommand(message.message);

	if (command === '/recap') {
		await handleRecapCommand(groupId, message.message);
	} else if (command === '/q') {
		await handleQCommand(groupId, message.message);
	}
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
		const currentHistory = getHistory();
		const response = await generateGptResponse(`${requestText} ${currentHistory}`);
		await sendGroupChatMessage(response, groupId);
		updateHistory(history, response);
	} catch (error) {
		console.error('Error processing q command:', error);
		await sendGroupChatMessage(error, groupId);
	}
}

function getCommand(messageText) {
	const parts = messageText.split(' ');

	if (parts.length > 0 && parts[0] in { '/recap': true, '/q': true }) {
		return parts[0];
	}

	return null;
}

module.exports = (async () => {
	await client.connect();
	client.addEventHandler(processCommand);
})();
