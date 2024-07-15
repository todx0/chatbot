import { Api } from 'telegram';
import TelegramBot from './bot';
import { initConfig, telegramClient } from './config';
import {
  createMessagesTable,
  eligibleForSpecialTreatment,
  getDataFromEvent,
  messageNotSeen,
  shouldTranscribeMedia,
  somebodyMentioned,
} from './utils/helper';

const bot = new TelegramBot(telegramClient);

const botWorkflow = async (event: Api.TypeUpdate): Promise<void> => {
  const msgData = getDataFromEvent(event);
  const { groupId, messageText, message, userEntity } = msgData;

  if (!groupId || !message || !messageNotSeen(message)) return;

  if (await bot.executeCommand(msgData)) return;

  if (somebodyMentioned(message)) {
    await bot.processMention(msgData);
    return;
  }

  const [user] = await bot.getUsers([userEntity]);
  if (eligibleForSpecialTreatment(user.username!)) {
    await bot.processSpecialTreatment(user.firstName!, msgData);
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
