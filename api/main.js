const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const {
	API_ID,
	API_HASH,
	SESSION,
	generateSummaryText,
	openai
} = require('../configs/config');

const client = new TelegramClient(new StringSession(SESSION), +API_ID, API_HASH, {
	connectionRetries: 5,
});

async function sendMessage(message, groupId) {
	const send = await client.invoke(
		new Api.messages.SendMessage({
			peer: groupId,
			message: `${message}`,
		})
	);
	return send;
}

async function getMessages(messagesLimit, groupId, messages = []) {
	for await (const message of client.iterMessages(`-${groupId}`, { limit: messagesLimit })) {
		messages.push(message.message);
	}
	return messages.reverse();
}

async function eventPrint(event) {
	const { message } = event;
	if (message?.message?.includes('/recap')) {
		const groupId = message._chatPeer.channelId;
		const msgLimit = parseInt(message.message.split(' ')[1]);
		if (Number.isNaN(msgLimit)) await sendMessage('Enter limit: /recap 50', groupId);
		else {
			const messages = await getMessages(msgLimit, groupId);
			if (msgLimit > 300) await sendMessage('Max recap limit 300: /recap 300', groupId);
			else {
				try {
					const response = await openai.createChatCompletion(
						{
							model: 'gpt-3.5-turbo',
							messages: [
								{
									role: 'user',
									content: `${generateSummaryText} ${messages}`
								}
							]
						}
					);
					const gptResponse = response.data.choices[0].message.content;
					await sendMessage(`${gptResponse}`, groupId);
				} catch (error) {
					await sendMessage(`${error.response.data.error.message}`, groupId);
				}
			}
		}
	}
}
async function main() {
	await client.connect();
	client.addEventHandler(eventPrint);
}
module.exports = (async () => {
	await client.connect();
	client.addEventHandler(eventPrint);
})();
module.exports = main;
