import { Api } from 'telegram';
import { botUsername, maxTokenLength, messageLimit, recapTextRequest } from './config';
import { ErrorHandler } from './errors/ErrorHandler';
import {
  approximateTokenLength,
  clearMessagesTable,
  convertToImage,
  downloadFile,
  filterMessages,
  insertToMessages,
  retry,
  splitMessageInChunks,
} from './helper';
import { generateGenAIResponse, returnCombinedAnswerFromMultipleResponses } from './modules/google/api';
import { SendMessageParams } from './types';

const { BOT_ID } = Bun.env;

export default class TelegramBot {
  private readonly client: any;

  private groupId: any;

  constructor(client: any, groupId: any = 0) {
    this.client = client;
    this.groupId = groupId;
  }

  getGroupId() {
    return this.groupId;
  }

  setGroupId(newValue: number): void {
    this.groupId = newValue;
  }

  async sendMessage(obj: SendMessageParams): Promise<Api.TypeUpdates | undefined> {
    const sendMsg = new Api.messages.SendMessage(obj);
    const result = await this.client.invoke(sendMsg);
    return result;
  }

  async sendImage(imagePath: string): Promise<Api.Message> {
    return this.client.sendMessage(this.groupId, { file: imagePath });
  }

  async getMessages(limit: number): Promise<string[]> {
    const messages: string[] = [];
    for await (const message of this.client.iterMessages(`-${this.groupId}`, { limit })) {
      if (message._sender?.firstName) {
        messages.push(`${message._sender.firstName}: ${message.message}`);
      }
    }
    return messages.reverse();
  }

  async handleClearCommand(): Promise<void> {
    await clearMessagesTable();
    await this.sendMessage({
      peer: this.groupId,
      message: 'History cleared',
    });
  }

  async handleRecapCommand(messageText: string): Promise<void | string> {
    const msgLimit = parseInt(messageText.split(' ')[1]);

    if (Number.isNaN(msgLimit)) {
      const obj = { peer: this.groupId, message: '/recap command requires a limit: /recap 50' };
      await this.sendMessage(obj);
      return;
    }

    if (msgLimit > messageLimit) {
      await this.sendMessage({
        peer: this.groupId,
        message: `Max recap limit is ${messageLimit}: /recap ${messageLimit}`,
      });
      return;
    }

    try {
      const messages = await this.getMessages(msgLimit);
      const filteredMessages = await filterMessages(messages);
      let response: string;

      const messagesLength = await approximateTokenLength(filteredMessages);

      if (messagesLength <= maxTokenLength) {
        const messageString = Array.isArray(filteredMessages) ? filteredMessages.join(' ') : filteredMessages;
        response = await generateGenAIResponse(`${recapTextRequest} ${messageString}`);
      } else {
        const chunks = await splitMessageInChunks(filteredMessages.toString());
        response = await returnCombinedAnswerFromMultipleResponses(chunks);
      }
      await this.sendMessage({ peer: this.groupId, message: response });
    } catch (error: any) {
      await this.sendMessage({ peer: this.groupId, message: String(error) });
      return ErrorHandler.handleError(error, true);
    }
  }

  async downloadAndSendImageFromUrl(url: string): Promise<void> {
    const buffer = await downloadFile(url);
    const imagePath = await convertToImage(buffer);
    await this.sendImage(imagePath);
  }

  async transcribeAudioMessage(msgId: number): Promise<Api.messages.TranscribedAudio> {
    const transcribeAudio = new Api.messages.TranscribeAudio({
      peer: this.groupId,
      msgId,
    });
    const result = await this.client.invoke(transcribeAudio);
    return result;
  }

  async waitForTranscription(messageId: number): Promise<string> {
    const response = await retry(() => this.transcribeAudioMessage(messageId), 3);
    if (response.text !== 'Error during transcription.') {
      return response.text;
    }
    return '';
  }

  async getMessageContentById(messageId: number): Promise<string> {
    const message = await this.client.getMessages(this.groupId, { ids: messageId });
    let content;
    if (message[0]?.media?.photo) {
      content = await this.getImageBuffer(message);
      content = await convertToImage(content);
    } else {
      content = message[0].message;
    }
    return content;
  }

  async getImageBuffer(message: any): Promise<Buffer> {
    const { photo } = message[0].media;
    const buffer = await this.client.downloadFile(
      new Api.InputPhotoFileLocation({
        id: photo.id,
        accessHash: photo.accessHash,
        fileReference: photo.fileReference,
        thumbSize: 'y',
      }),
      {
        dcId: photo.dcId,
      },
    );
    return buffer;
  }

  async checkReplyIdIsBotId(messageId: number): Promise<boolean> {
    if (!messageId) return false;
    const messages = await this.client.getMessages(this.groupId, { ids: messageId });
    const senderId = String(messages[0]._senderId);
    if (senderId === String(BOT_ID)) {
      return true;
    }
    return false;
  }

  async processMessage(messageText: string, history = true): Promise<void | string> {
    let message = messageText.replace(botUsername, '');
    if (history) {
      message = await generateGenAIResponse(message);
    }
    try {
      // no idea why my sendMessage is working only for channels but not groups. Using raw function.
      await this.client.sendMessage(`-${this.groupId}`, { message });
    } catch (error: any) {
      return ErrorHandler.handleError(error, true);
    }
  }

  // TODO: remove comments, debug stuff and split
  async removeLurkers(limit = 3000): Promise<void> {
    // get people who sent a message to chat
    const uniqSenders = new Set();
    for await (const message of this.client.iterMessages(`-${this.groupId}`, { limit })) {
      if (message._sender?.id?.value) {
        const value = String(message._sender.id.value);
        uniqSenders.add(value);
      }
    }
    // get all chat participants
    const uniqUsers = new Set();
    const userEntities = [];
    for await (const user of this.client.iterParticipants(`-${this.groupId}`, { limit })) {
      const userNameId = { user: user.username, id: String(user.id.value) };
      userEntities.push(userNameId);
    }
    userEntities.forEach((userEntity: any) => {
      const userId = userEntity.id;
      const userName = userEntity.user;
      if (userId && !userId.includes('-') && userName !== 'channel_bot' && userId !== BOT_ID) {
        uniqUsers.add(userId);
      }
    });

    const intersection = new Set([...uniqUsers].filter((value) => !uniqSenders.has(value)));
    const usersIdToDelete = [...intersection];

    if (!usersIdToDelete.length) {
      await this.sendMessage({
        peer: this.groupId,
        message: 'Все молодцы',
      });
    }
    else if (usersIdToDelete.length) {
      await this.sendMessage({
        peer: this.groupId,
        message: 'Пошли нахуй:',
      });
    }
    // only deletes if supergroup
    usersIdToDelete.forEach(async (userId: any) => {
      try {
        Bun.sleep(3000);
        await this.client.invoke(
          new Api.channels.EditBanned({
            channel: this.groupId,
            participant: userId,
            bannedRights: new Api.ChatBannedRights({
              untilDate: 0,
              viewMessages: true,
              sendMessages: true,
              sendMedia: true,
              sendStickers: true,
              sendGifs: true,
              sendGames: true,
              sendInline: true,
              embedLinks: true,
            }),
          }),
        );
      } catch (error: any) {
        return ErrorHandler.handleError(error, true);
      }
    });
  }

  async fetchAndInsertMessages(limit: number): Promise<void> {
    const messages = await this.getMessages(limit);
    messages.forEach((message) => insertToMessages({ role: 'user', parts: [{ text: message }] }));
  }
}
