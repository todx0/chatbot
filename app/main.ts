import { Api } from 'telegram';
import TelegramBot from './bot';
import { initConfig, telegramClient } from './config';
import {
  createMessagesTable,
  getDataFromEvent,
  messageNotSeen,
  shouldTranscribeMedia,
  somebodyMentioned,
} from './utils/helper';

const bot = new TelegramBot(telegramClient);

const botWorkflow = async (event: Api.TypeUpdate) => {
  const messageData = getDataFromEvent(event);
  const { groupId, messageText, message } = messageData;

  if (!groupId || !messageText || !message || !messageNotSeen(message)) return;

  if (await bot.executeCommand(messageText, groupId)) return;

  if (somebodyMentioned(message)) {
    await bot.processMention(messageData);
    return;
  }
  if (shouldTranscribeMedia(message)) {
    await bot.transcribeMedia(groupId, message);
    return;
  }
};

(async () => {
  initConfig();
  await createMessagesTable();
  await telegramClient.connect();
  telegramClient.addEventHandler(botWorkflow);
})();
