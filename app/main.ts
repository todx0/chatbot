import TelegramBot from './bot';
import { client, initConfig } from './config';
import {
  createMessagesTable,
  getDataFromEvent,
  messageNotSeen,
  shouldTranscribeMedia,
  somebodyMentioned,
} from './utils/helper';

initConfig();
const bot = new TelegramBot(client);

export const botWorkflow = async (event: any) => {
  const { groupId, replyToMsgId, messageText, message } = getDataFromEvent(event);

  if (!groupId || !messageText || !message || !messageNotSeen(message)) return;

  if (await bot.executeCommand(messageText, groupId)) return;

  if (somebodyMentioned(message)) {
    await bot.processMention(groupId, replyToMsgId, messageText, message.id);
    return;
  }

  if (shouldTranscribeMedia(message)) {
    await bot.transcribeMedia(groupId, message);
    return;
  }
};

(async () => {
  await createMessagesTable();
  await client.connect();
  client.addEventHandler(botWorkflow);
})();
