import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import TelegramBot, {
} from './mainHelper';
import {
	botUsername,
	loadConfig
} from './config';
import {
	messageNotSeen,
	shouldRandomReply,
	somebodyMentioned,
	createMessagesTable,
	shouldTranscribeMedia,
} from './helper';

// use this workaround instead destructuring config because 'bun test' fails otherwise.
const { SESSION, API_ID, API_HASH } = Bun.env;

try {
	loadConfig();
} catch (error) {
	console.error(error);
	process.exit(1);
}
const client = new TelegramClient(new StringSession(SESSION), +API_ID!, API_HASH!, {
	connectionRetries: 5,
});
export default client;

const bot = new TelegramBot(client);

export const botWorkflow: (event: any) => Promise<void> = async (event: any) => {
	const { message } = event;

	if (!message) return;
	if (!messageNotSeen(message)) return;

	const groupId = message._chatPeer.channelId;
	const messageText = message.message;

	bot.setGroupId(groupId);

	const commandMappings: Record<string, (msgText: string) => Promise<void>> = {
		'/recap': (msgText) => bot.handleRecapCommand(msgText),
		'/q': (msgText) => bot.handleQCommand(msgText),
		'/img': (msgText) => bot.handleImgCommand(msgText),
		'/imagine': (msgText) => bot.handleImagineCommand(msgText),
		'/clear': () => bot.handleClearCommand(),
	};

	for (const command in commandMappings) {
		if (messageText.includes(command)) {
			await commandMappings[command](messageText);
			return;
		}
	}

	if (shouldRandomReply(message)) {
		await bot.fetchAndInsertMessages(10);
		await bot.processMessage(messageText, message.id);
		return;
	}

	if (somebodyMentioned(message)) {
		const replyToMsgId = event.message.replyTo?.replyToMsgId;
		const isBotCalled = messageText.includes(botUsername);

		if (replyToMsgId && (await bot.checkReplyIdIsBotId(replyToMsgId))) {
			await bot.processMessage(messageText, message.id);
			return;
		}

		if (isBotCalled) {
			const messageContentWithoutBotName = messageText.replace(botUsername, '');
			await bot.processMessage(messageContentWithoutBotName, message.id);
			return;
		}
	}

	if (shouldTranscribeMedia(message)) {
		const transcribedAudio = await bot.waitForTranscription(message.id);
		if (transcribedAudio) {
			await bot.processMessage(transcribedAudio, message.id, false);
		}
	}
};

(async () => {
	await createMessagesTable();
	await client.connect();
	client.addEventHandler(botWorkflow);
})();
