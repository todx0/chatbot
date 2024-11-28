import TelegramBot from '@app/bot';
import { initConfig, telegramClient } from '@app/config';
import { createMessagesTable, isRandomReply, shouldTranscribeMedia, somebodyMentioned } from '@app/utils/helper';
import { Api } from 'telegram';

const bot = new TelegramBot(telegramClient);

async function botWorkflow(event: Api.TypeUpdate): Promise<void> {
  const msgData = await bot.prepareMsgData(event);
  if (!msgData) return;

  if (await bot.executeCommand(msgData)) return;

  if (somebodyMentioned(msgData)) {
    await bot.processMention(msgData);
    return;
  }

  if (isRandomReply(msgData)) {
    await bot.processRandomReply(msgData);
    return;
  }

  if (shouldTranscribeMedia(msgData)) {
    await bot.transcribeMedia(msgData);
    return;
  }
}

(async () => {
  initConfig();
  await createMessagesTable();
  await telegramClient.connect();
  telegramClient.addEventHandler(botWorkflow);
})();
