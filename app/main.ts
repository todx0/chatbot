import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import {
	sendMessage,
	processMessage,
	checkReplyIdIsBotId,
	waitForTranscription,
	getMessageContentById,
} from './mainFunctions';
import {
	botUsername,
	chatCommands,
	commandHandlers
} from './config';
import {
	getCommand,
	messageNotSeen,
	shouldRandomReply,
	somebodyMentioned,
	createMessagesTable,
	shouldTranscribeMedia,
} from './helper';

// use this workaround instead destructuring config because 'bun test' fails otherwise.
const { SESSION, API_ID, API_HASH } = Bun.env;

if (API_ID === undefined) {
	throw new Error('API_ID is not defined in the environment variables');
}
if (API_HASH === undefined) {
	throw new Error('API_HASH is not defined in the environment variables');
}
const client = new TelegramClient(new StringSession(SESSION), +API_ID, API_HASH, {
	connectionRetries: 5,
});
export default client;

export const processCommand = async (event: any): Promise<void> => {
	const { message } = event;

	if (!message) return;
	if (!messageNotSeen(message)) return;

	const groupId = message._chatPeer.channelId;
	const messageText = message.message;

	const command = getCommand(messageText, chatCommands);
	const handler = commandHandlers[command];
	if (handler) {
		await handler(groupId, messageText, client);
	}

	if (shouldRandomReply(message)) {
		await processMessage(messageText, groupId, message.id);
		return;
	}

	if (somebodyMentioned(message)) {
		const { replyToMsgId } = event.message.replyTo;
		const isBotMentioned: boolean = await checkReplyIdIsBotId(replyToMsgId, groupId);
		const isBotCalled: boolean = messageText.includes(botUsername);

		if (isBotMentioned) {
			await processMessage(messageText, groupId, message.id);
			return;
		}

		if (isBotCalled) {
			const messageContent = await getMessageContentById(replyToMsgId, groupId);
			await processMessage(messageContent, groupId, replyToMsgId);
			return;
		}
	}

	if (shouldTranscribeMedia(message)) {
		const transcribedAudio = await waitForTranscription(message.id, groupId);
		if (transcribedAudio) {
			await sendMessage({
				peer: groupId,
				message: transcribedAudio,
				replyToMsgId: message.id,
				silent: true
			});
		}
	}
};

(async () => {
	await createMessagesTable();
	await client.connect();
	client.addEventHandler(processCommand);
})();
