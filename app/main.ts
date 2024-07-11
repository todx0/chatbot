import TelegramBot from './bot';
import { client, initConfig } from './config';
import { MessageData } from './types';
import {
  createMessagesTable,
  getDataFromEvent,
  messageNotSeen,
  shouldTranscribeMedia,
  somebodyMentioned,
} from './utils/helper';

const bot = new TelegramBot(client);

const botWorkflow = async (event: any) => {
  const { groupId, replyToMsgId, messageText, message } = getDataFromEvent(event);

  if (!groupId || !messageText || !message || !messageNotSeen(message)) return;

  if (await bot.executeCommand(messageText, groupId)) return;

  if (somebodyMentioned(message)) {
    // Make getDataFromEvent return MessageData type to avoid creating messageToProcess
    const messageToProcess: MessageData = {
      groupId,
      messageText,
      replyToMsgId,
      messageId: message.id,
      photo: !!message?.media?.photo,
    };
    await bot.processMention(messageToProcess);
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
  await client.connect();
  client.addEventHandler(botWorkflow);
})();
