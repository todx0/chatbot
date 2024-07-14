import { Api } from 'telegram';
import TelegramBot from './bot';
import { config, getSpecialTreatmentUsers, initConfig, telegramClient } from './config';
import { generateResponseFromImage } from './modules/google/api';
import {
  convertToImage,
  createMessagesTable,
  eligibleForSpecialTreatment,
  getDataFromEvent,
  messageNotSeen,
  shouldTranscribeMedia,
  somebodyMentioned,
} from './utils/helper';

const bot = new TelegramBot(telegramClient);

const botWorkflow = async (event: Api.TypeUpdate): Promise<void> => {
  const messageData = getDataFromEvent(event);
  const { groupId, messageText, message, userEntity } = messageData;

  if (!groupId || !message || !messageNotSeen(message)) return;

  if (await bot.executeCommand(messageText, groupId)) return;

  if (somebodyMentioned(message)) {
    await bot.processMention(messageData);
    return;
  }
  const [username] = await bot.getUsers([userEntity]);
  if (eligibleForSpecialTreatment(username)) {
    await bot.processSpecialTreatment(messageData);
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
