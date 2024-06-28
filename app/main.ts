import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index';
import TelegramBot from './bot';
import { botUsername, config, loadConfig } from './config';
import {
  createMessagesTable,
  getDataFromEvent,
  messageNotSeen,
  shouldTranscribeMedia,
  somebodyMentioned,
} from './utils/helper';

try {
  loadConfig();
} catch (error) {
  console.error(error);
  process.exit(1);
}
const { SESSION, API_ID, API_HASH } = config;
const client = new TelegramClient(new StringSession(SESSION), +API_ID!, API_HASH!, {
  connectionRetries: 5,
});
export default client;
const bot = new TelegramBot(client);

export const botWorkflow = async (event: any) => {
  const {
    groupId,
    replyToMsgId,
    messageText,
    message,
  } = getDataFromEvent(event);

  if (!groupId || !messageText || !message || !messageNotSeen(message)) return;

  const commandMappings: Record<string, (msgText: string) => Promise<void | string>> = {
    '/recap': (msgText) => bot.handleRecapCommand(msgText),
    '/clear': () => bot.handleClearCommand(),
    '/scan': () => bot.removeLurkers(),
    '/votekick': (msgText) => bot.processVoteKick(msgText),
    '/users': () => bot.printUserEntities(),
  };

  const executeCommand = async (messageText: string) => {
    bot.setGroupId(groupId);
    for (const command in commandMappings) {
      if (messageText.includes(command)) {
        await commandMappings[command](messageText);
        return true;
      }
    }
    return false;
  };

  if (await executeCommand(messageText)) return;

  const processMention = async () => {
    bot.setGroupId(groupId);
    const isBotCalled = messageText.includes(botUsername);

    if (replyToMsgId && (await bot.checkReplyIdIsBotId(replyToMsgId))) {
      await bot.processMessage(messageText, message.id);
      return;
    }

    if (isBotCalled) {
      if (replyToMsgId) {
        const replyMessageContent = await bot.getMessageContentById(replyToMsgId);
        await bot.processMessage(replyMessageContent, message.id);
      } else {
        const messageContentWithoutBotName = messageText.replace(botUsername, '');
        await bot.processMessage(messageContentWithoutBotName, message.id);
      }
    }
  };

  if (somebodyMentioned(message)) {
    await processMention();
    return;
  }

  if (shouldTranscribeMedia(message)) {
    const transcribedAudio = await bot.waitForTranscription(message.id);
    if (transcribedAudio) {
      await bot.processMessage(transcribedAudio, false);
    }
  }
};

(async () => {
  await createMessagesTable();
  await client.connect();
  client.addEventHandler(botWorkflow);
})();
