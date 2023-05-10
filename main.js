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
					content: `${openAiTextRequest} ${messages}`
				}
			]
		});

		return response.data.choices[0].message.content;
	} catch (error) {
		// throw new Error(error.response.data.error.message);
		return error.response.data.error.message;
	}
}

async function processRecapCommand(event) {
	let groupId;
	const { message } = event;
	if (message?.message?.includes('/recap')) {
		groupId = message._chatPeer.channelId;
		const msgLimit = parseInt(message.message.split(' ')[1]);

		if (Number.isNaN(msgLimit)) {
			await sendGroupChatMessage('Enter limit: /recap 50', groupId);
		} else if (msgLimit > 300) {
			await sendGroupChatMessage('Max recap limit 300: /recap 300', groupId);
		} else {
			const messages = await getMessages({ limit: msgLimit, groupId: groupId });
			const filteredMessages = filterMessages(messages);

			try {
				const response = await generateGptResponse(filteredMessages);
				await sendGroupChatMessage(response, groupId);
			} catch (error) {
				console.error('Error processing recap command:', error);
				await sendGroupChatMessage(error, groupId);
			}
		}
	}
}

module.exports = (async () => {
	await client.connect();
	client.addEventHandler(processRecapCommand);
})();
