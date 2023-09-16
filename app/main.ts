import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import {
	sendMessage,
	processMessage,
	checkReplyIdIsBotId,
	waitForTranscription,
	getMessageContentById,
} from './mainHelper';
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
		// TODO pass more than 1 message for bot to understand context
		await processMessage(messageText, groupId, message.id);
		return;
	}

	if (somebodyMentioned(message)) {
		const replyToMsgId = event.message.replyTo?.replyToMsgId;
		const isBotCalled = messageText.includes(botUsername);

		if (replyToMsgId && (await checkReplyIdIsBotId(replyToMsgId, groupId))) {
		  await processMessage(messageText, groupId, message.id);
		  return;
		}

		if (isBotCalled) {
		  const messageContentWithoutBotName = messageText.replace(botUsername, '');
		  await processMessage(messageContentWithoutBotName, groupId, replyToMsgId);
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
