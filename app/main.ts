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
import { initializeTranslations } from './utils/translation';

// const { SESSION, API_ID, API_HASH } = Bun.env;

try {
  loadConfig();
  // await initializeTranslations(config.LANGUAGE);
} catch (error) {
  console.error(error);
  process.exit(1);
}
const { SESSION, API_ID, API_HASH } = config;
const client = new TelegramClient(new StringSession(SESSION), +API_ID!, API_HASH!, {
  connectionRetries: 5,
});
export default client;

export const botWorkflow = async (event: any) => {
  const {
    groupId,
    replyToMsgId,
    messageText,
    message,
  } = getDataFromEvent(event);

  if (!groupId || !messageText || !message) return;
  if (!messageNotSeen(message)) return;

  const bot = new TelegramBot(client);
  bot.setGroupId(groupId);

  const commandMappings: Record<string, (msgText: string) => Promise<void | string>> = {
    '/recap': (msgText) => bot.handleRecapCommand(msgText),
    '/clear': () => bot.handleClearCommand(),
    '/scan': () => bot.removeLurkers(),
    '/votekick': (msgText) => bot.processVoteKick(msgText),
    '/users': () => bot.printUserEntities(),
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
      await bot.processMessage(transcribedAudio, false);
    }
  }
};

(async () => {
  await createMessagesTable();
  await client.connect();
  client.addEventHandler(botWorkflow);
})();
