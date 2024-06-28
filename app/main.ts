import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index';
import TelegramBot from './bot';
import { config, loadConfig } from './config';
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

  if (await bot.executeCommand(messageText, groupId)) return;

  if (somebodyMentioned(message)) {
    await bot.processMention(groupId, replyToMsgId, messageText, message.id);
    return;
  }

  if (shouldTranscribeMedia(message)) {
    bot.transcribeMedia(groupId, message);
    return;
  }
};

(async () => {
  await createMessagesTable();
  await client.connect();
  client.addEventHandler(botWorkflow);
})();
