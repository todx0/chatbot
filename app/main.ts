import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index';
import TelegramBot, {
} from './mainHelper';
import {
	botUsername,
	loadConfig,
} from './config';
import {
	messageNotSeen,
	somebodyMentioned,
	createMessagesTable,
	shouldTranscribeMedia,
	checkAndUpdateDatabase,
} from './helper';

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

export const botWorkflow = async (event: any) => {
	function getDataFromEvent(event: any) {
		let groupId;
		let replyToMsgId;
		let messageText;
		let message;
		if (typeof event.message === 'string') {
			groupId = event.chatId;
			replyToMsgId = event.replyTo;
			messageText = event.message;
			message = event;
		} else if (typeof event.message === 'object') {
			// if (!event.message._chatPeer || !event.message._chatPeer.channelId) return;
			groupId = event.message._chatPeer.channelId;
			replyToMsgId = event.message.replyTo?.replyToMsgId;
			messageText = event.message.message;
			message = event.message;
		}
		return {
			groupId,
			replyToMsgId,
			messageText,
			message,
		};
	}

	const {
		groupId, replyToMsgId, messageText, message,
	} = getDataFromEvent(event);

	if (!groupId || !messageText || !message) return;
	if (!messageNotSeen(message)) return;

	const bot = new TelegramBot(client);
	await bot.setGroupId(groupId);

	const commandMappings: Record<string, (msgText: string) => Promise<void>> = {
		'/recap': (msgText) => bot.handleRecapCommand(msgText),
		'/clear': () => bot.handleClearCommand(),
	};

	for (const command in commandMappings) {
		if (messageText.includes(command)) {
			await commandMappings[command](messageText);
			return;
		}
	}

	if (somebodyMentioned(message)) {
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
