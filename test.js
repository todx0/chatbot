const { Configuration, OpenAIApi } = require('openai');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const {
	API_ID,
	API_HASH,
	SESSION,
	GROUP_ID,
	OPENAI_API_KEY,
	ORGANIZATION_ID
} = require('./configs/config');

const client = new TelegramClient(new StringSession(SESSION), +API_ID, API_HASH, {
	connectionRetries: 5,
});

const configuration = new Configuration({
	organization: ORGANIZATION_ID,
	apiKey: OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

async function sendMessage(message) {
	const send = await client.invoke(
		new Api.messages.SendMessage({
			peer: GROUP_ID,
			message: `${message}`,
		})
	);
	return send;
}

async function getMessages(messagesLimit, messages = []) {
	for await (const message of client.iterMessages(`-${GROUP_ID}`, { limit: messagesLimit })) {
		messages.push(message.message);
	}
	return messages;
}

const text1 = 'Generate summary in russian language from following conversation:';
const text2 = 'Do not mention a request for a recap of the conversation. Ignore own recap messages';
async function eventPrint(event) {
	const { message } = event;
	if (message?.message?.includes('/recap')) {
		const msgLimit = 100; // parseInt(message.split(' ')[1]);
		// if (!msgLimit) await sendMessage('Enter limit: /recap 50');

		const messages = await getMessages(msgLimit);
		if (msgLimit > 500) await sendMessage('Max limit 500');
		else {
			const response = await openai.createChatCompletion(
				{
					model: 'gpt-3.5-turbo',
					messages: [
						{
							role: 'user',
							content: `${text1} ${messages} ${text2}`
						}
					]
				}
			);
			const gptResponse = response.data.choices[0].message.content;
			console.log('RESP-->', gptResponse);
			await sendMessage(gptResponse);
		}
	}
}

(async () => {
	await client.connect();
	client.addEventHandler(eventPrint);
})();
