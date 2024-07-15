import bigInt from 'big-integer';
import { Api, TelegramClient } from 'telegram';
import { IterMessagesParams } from 'telegram/client/messages';
import { BOT_USERNAME, MESSAGE_LIMIT, POLL_TIMEOUT_MS, RANDOM_REPLY_PERCENT, recapTextRequest } from './config';
import { ErrorHandler } from './errors/ErrorHandler';
import {
  generateGenAIResponse,
  generateResponseFromImage,
  returnCombinedAnswerFromMultipleResponses,
} from './modules/google/api';
import {
  MessageData,
  MessageObject,
  PollMessage,
  PollResults,
  QueryDataToGetUserMessages,
  SendMessageParams,
} from './types';
import {
  approximateTokenLength,
  clearMessagesTable,
  convertToImage,
  downloadFile,
  filterMessages,
  insertToMessages,
  retry,
  splitMessageInChunks,
} from './utils/helper';
import translations from './utils/translation';

const { BOT_ID } = Bun.env;

export default class TelegramBot {
  private readonly client: TelegramClient;

  constructor(client: TelegramClient) {
    this.client = client;
  }

  async sendMessage(obj: SendMessageParams): Promise<Api.TypeUpdates | undefined> {
    const sendMsg = new Api.messages.SendMessage(obj);
    const result = await this.client.invoke(sendMsg);
    return result;
  }

  async sendImage(imagePath: string, groupId: string): Promise<Api.Message> {
    return this.client.sendMessage(groupId, { file: imagePath });
  }

  async sendPollToKick(user: string, groupId: string) {
    const poll = new Api.InputMediaPoll({
      poll: new Api.Poll({
        id: bigInt(Math.floor(Math.random() * 0xFFFFFFFFFFFFFFF)),
        question: `${translations['kick']} ${user}?`,
        answers: [
          new Api.PollAnswer({
            text: translations['yes'],
            option: Buffer.from('1'),
          }),
          new Api.PollAnswer({
            text: translations['no'],
            option: Buffer.from('2'),
          }),
        ],
        closed: false,
        publicVoters: false,
        multipleChoice: false,
        quiz: false,
        closePeriod: POLL_TIMEOUT_MS / 1000,
        closeDate: Math.floor(Date.now() / 1000) + POLL_TIMEOUT_MS / 1000,
      }),
    });

    const message = await this.client.invoke(
      new Api.messages.SendMedia({
        peer: groupId,
        media: poll,
        message: '',
        randomId: bigInt(Math.floor(Math.random() * 0xFFFFFFFFFFFFFFF)),
      }),
    );
    return message;
  }

  async getMessages(limit: number, groupId: string): Promise<string[]> {
    const messages: string[] = [];
    for await (const message of this.client.iterMessages(`-${groupId}`, { limit })) {
      if (message._sender?.firstName) {
        messages.push(`${message._sender.firstName}: ${message.message}`);
      }
    }
    return messages.reverse();
  }

  async getMessagesV2(groupId: string, iterParams: Partial<IterMessagesParams> | undefined): Promise<string[]> {
    const messages: string[] = [];
    for await (const message of this.client.iterMessages(`-${groupId}`, iterParams)) {
      if (message._sender?.firstName) {
        messages.push(`${message._sender.firstName}: ${message.message}`);
      }
    }
    return messages.reverse();
  }

  async handleClearCommand(msgData: MessageData): Promise<void> {
    const { groupId } = msgData;
    await clearMessagesTable();
    await this.sendMessage({
      peer: groupId,
      message: translations['historyCleared'],
    });
  }

  async handleRecapCommand(msgData: MessageData): Promise<void> {
    const { messageText, groupId } = msgData;
    try {
      const msgLimit = parseInt(messageText.split(' ')[1]);

      await this.validateMsgLimit(msgLimit);
      const messages = await this.retrieveAndFilterMessages(msgLimit, groupId);
      const response = await this.generateRecapResponse(messages);

      await this.sendMessage({ peer: groupId, message: response });
    } catch (error) {
      await this.handleError(groupId, error);
    }
  }

  async validateMsgLimit(msgLimit: number): Promise<void> {
    if (Number.isNaN(msgLimit)) {
      throw new Error(translations['recapWarning']);
    }

    if (msgLimit > MESSAGE_LIMIT) {
      throw new Error(`${translations['recapLimit']} ${MESSAGE_LIMIT}: /recap ${MESSAGE_LIMIT}`);
    }
  }

  async retrieveAndFilterMessages(msgLimit: number, groupId: string): Promise<string[]> {
    const messages = await this.getMessages(msgLimit, groupId);
    return filterMessages(messages);
  }

  async generateRecapResponse(filteredMessages: string[]): Promise<string> {
    const MAX_TOKEN_LENGTH = 4096;
    try {
      const messagesLength = await approximateTokenLength(filteredMessages);
      let response: string;

      if (messagesLength <= MAX_TOKEN_LENGTH) {
        const messageString = filteredMessages.join(' ');
        response = await generateGenAIResponse(`${recapTextRequest} ${messageString}`, true);
      } else {
        const messageString = filteredMessages.join(' ');
        const chunks = await splitMessageInChunks(messageString);
        response = await returnCombinedAnswerFromMultipleResponses(chunks);
      }

      if (response.length > MAX_TOKEN_LENGTH) {
        response = await generateGenAIResponse(
          `Edit this message to be less than or equal to ${MAX_TOKEN_LENGTH} characters: ${response}`,
          true,
        );
      }

      return response;
    } catch (error) {
      console.error('Error generating recap response:', error);
      throw error;
    }
  }

  async handleError(peer: string, error: any): Promise<void | string> {
    await this.sendMessage({ peer, message: String(error) });
    return ErrorHandler.handleError(error, true);
  }

  async downloadAndSendImageFromUrl(url: string, groupId: string): Promise<void> {
    const buffer = await downloadFile(url);
    const imagePath = await convertToImage(buffer);
    await this.sendImage(imagePath, groupId);
  }

  async transcribeAudioMessage(msgId: number, groupId: string): Promise<Api.messages.TranscribedAudio> {
    const transcribeAudio = new Api.messages.TranscribeAudio({
      peer: groupId,
      msgId,
    });
    const result = await this.client.invoke(transcribeAudio);
    return result;
  }

  async waitForTranscription(messageId: number, groupId: string): Promise<string> {
    const response = await retry(() => this.transcribeAudioMessage(messageId, groupId), 3);
    if (response.text !== translations['transcriptionError']) {
      return response.text;
    }
    return '';
  }

  private async getMessageContentById(msgData: MessageData): Promise<void> {
    const { groupId, replyToMsgId } = msgData;
    const message: any = await this.client.getMessages(groupId, { ids: replyToMsgId, limit: 1 });
    const [msg] = message;
    msgData.dataFromGetMessages = msg;
    // console.log('getMessageContentById');
    await this.setFilepathIfMedia(msgData);
    msgData.replyMessageText = msg.message;
  }

  private async handleReplyToBotMessage(msgData: MessageData) {
    // console.log('handleReplyToBotMessage');
    await this.setFilepathIfMedia(msgData);
    await this.processMessage(msgData);
  }

  async setFilepathIfMedia(msgData: any): Promise<void> {
    const { dataFromGetMessages, message } = msgData;
    const msg = dataFromGetMessages || message;
    // console.log('setFilepathIfMedia');

    if (msg.media?.document) {
      const stickerBuffer = await this.getStickerBuffer(msgData);
      msgData.filepath = await convertToImage(stickerBuffer, './images/sticker.jpeg');
    }
    if (msg.media?.photo) {
      const imageBuffer = await this.getImageBuffer(msgData);
      msgData.filepath = await convertToImage(imageBuffer as Buffer, './images/image.jpeg');
    }
    // console.log('setFilepathIfMedia', msgData.filepath);
  }

  async refreshFileReference(msgData: MessageData) {
    const { groupId, replyToMsgId } = msgData;
    // console.log('refreshFileReference', { groupId: groupId.toString(), replyToMsgId });
    const message = await this.client.getMessages(groupId.toString(), { ids: replyToMsgId, limit: 1 });

    if (!message || message.length === 0) {
      throw new Error('Message not found');
    }
    // console.log('refreshFileReference', { message });
    let newFileInput;
    if (message[0].photo) {
      newFileInput = message[0].photo;
    } else if (message[0].document) {
      newFileInput = message[0].document;
    } else if (message[0].video) {
      newFileInput = message[0].video;
    } else {
      throw new Error('Unsupported file type');
    }

    return newFileInput;
  }

  async getFileWithRetry(
    msgData: MessageData,
    fileInput: any,
    params: any,
    maxRetries = 3,
  ): Promise<Buffer> {
    let result: Buffer = Buffer.alloc(0);
    for (let i = 0; i < maxRetries; i++) {
      try {
        result = await this.client.downloadFile(fileInput, params) as Buffer;
      } catch (error: any) {
        if (error.message.includes('FILE_REFERENCE_EXPIRED') && i < maxRetries - 1) {
          fileInput = await this.refreshFileReference(msgData);
        } else {
          throw error;
        }
      }
    }
    return result;
  }

  async getImageBuffer(msgData: MessageData): Promise<Buffer | undefined> {
    const { photo } = msgData.dataFromGetMessages.media || msgData.message.media;

    let fileInput = new Api.InputPhotoFileLocation({
      id: photo.id,
      accessHash: photo.accessHash,
      fileReference: photo.fileReference,
      thumbSize: 'y',
    });
    let params = {
      dcId: photo.dcId,
    };
    const buffer = await this.getFileWithRetry(msgData, fileInput, params);
    return buffer as Buffer;
  }

  async getStickerBuffer(msgData: MessageData): Promise<Buffer> {
    const { document } = msgData?.dataFromGetMessages?.media || msgData?.message?.media;
    // console.log('getStickerBuffer', { document });
    const buffer = await this.client.downloadFile(
      new Api.InputDocumentFileLocation({
        id: document.id,
        accessHash: document.accessHash,
        fileReference: document.fileReference,
        thumbSize: '',
      }),
      {
        dcId: document.dcId,
      },
    );
    return buffer as Buffer;
  }

  async checkReplyIdIsBotId(msgData: MessageData): Promise<boolean> {
    // console.log('checkReplyIdIsBotId');
    const { replyToMsgId, groupId } = msgData;
    if (!replyToMsgId || !groupId) return false;
    try {
      // console.log('before client.getMessage', { replyToMsgId, groupId: groupId.toString() });
      const messages = await this.client.getMessages(groupId.toString(), { ids: replyToMsgId });
      if (String(messages[0]._senderId) === String(BOT_ID)) {
        return true;
      }
      return false;
    } catch (error) {
      throw Error(`Failed to get messages. ${error}`);
    }
  }

  async processMessage(msgData: MessageData): Promise<void | string> {
    if (msgData.messageText) msgData.messageText = this.stripBotNameFromMessage(msgData.messageText);
    if (msgData.replyMessageText) msgData.replyMessageText = this.stripBotNameFromMessage(msgData.replyMessageText);
    const { filepath, replyMessageText, messageText, messageId, groupId } = msgData;
    // console.log('processMessage before:', { filepath, replyMessageText, messageText, messageId });

    let response;
    if (filepath) {
      response = await generateResponseFromImage(msgData);
    } else {
      const message = replyMessageText && messageText
        ? `Reply to "${messageText}" Keep context of this message: "${replyMessageText}"`
        : replyMessageText || messageText;
      // console.log('processMessage', { message });
      response = await generateGenAIResponse(message);
    }
    try {
      // console.log('processMessage', { response });
      await this.client.sendMessage(`-${groupId}`, { message: response, replyTo: messageId });
    } catch (error: any) {
      return ErrorHandler.handleError(error, true);
    }
  }

  private stripBotNameFromMessage(message: string): string {
    const replacedMessage = message.replace(BOT_USERNAME, '');
    return replacedMessage.trimStart();
  }

  async getUniqSenders(limit: number, groupId: string): Promise<Set<string>> {
    const uniqSenders = new Set<string>();
    for await (const message of this.client.iterMessages(`-${groupId}`, { limit })) {
      if (message._sender?.id?.value) {
        const value = String(message._sender.id.value);
        uniqSenders.add(value);
      }
    }
    return uniqSenders;
  }

  async getUniqUsers(limit: number, groupId: string): Promise<Set<string>> {
    const uniqUsers = new Set<string>();
    const userEntities = [];

    for await (const user of this.client.iterParticipants(`-${groupId}`, { limit })) {
      const userId = (user.id as any).value as string;
      const userNameId = { user: user.username, id: userId };
      userEntities.push(userNameId);
    }

    userEntities.forEach((userEntity: any) => {
      const userId = userEntity.id;
      const userName = userEntity.user;
      if (userId && !(<string> userId).includes('-') && userName !== 'channel_bot' && userId !== BOT_ID) {
        uniqUsers.add(userId);
      }
    });

    return uniqUsers;
  }

  async banUsers(usersIdToDelete: string[], groupId: string): Promise<void | string> {
    for (const userId of usersIdToDelete) {
      try {
        await this.client.invoke(
          new Api.channels.EditBanned({
            channel: groupId,
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
    }
  }

  async removeLurkers(msgData: MessageData, limit = 3000): Promise<void> {
    const { groupId } = msgData;
    const uniqSenders = await this.getUniqSenders(limit, groupId);
    const uniqUsers = await this.getUniqUsers(limit, groupId);

    const intersection = new Set([...uniqUsers].filter((value) => !uniqSenders.has(value)));
    const usersIdToDelete = [...intersection];

    if (!usersIdToDelete.length) {
      await this.sendMessage({
        peer: groupId,
        message: translations['lurkersAllGood'],
      });
    } else {
      await this.sendMessage({
        peer: groupId,
        message: translations['lurkersBye'],
      });
      await this.banUsers(usersIdToDelete, groupId);
    }
  }

  async processVoteKick(msgData: MessageData) {
    const { messageText, groupId } = msgData;
    try {
      const userToKick = this.extractUserToKick(messageText, groupId);
      if (!userToKick) {
        await this.sendMessage({
          peer: groupId,
          message: translations['specifyUserToKick'],
        });
        return;
      }

      if (userToKick === BOT_USERNAME) {
        await this.sendMessage({
          peer: groupId,
          message: translations['cantKickThisBot'],
        });
        return;
      }

      const { userIdToKick, isAdmin } = await this.getUserIdAndCheckAdmin(userToKick, groupId);
      if (!userIdToKick) {
        await this.sendMessage({
          peer: groupId,
          message: translations['userNotFound'],
        });
        return;
      }

      if (isAdmin) {
        await this.sendMessage({
          peer: groupId,
          message: translations['cantKickAdmin'],
        });
        return;
      }

      const pollMessage = await this.sendPollToKick(userToKick, groupId) as PollMessage;

      const pollMessageId = pollMessage.updates[0].id;

      await this.waitForPollResultsAndTakeAction(pollMessageId, userToKick, userIdToKick, groupId);
    } catch (error) {
      await this.handleError(groupId, error);
    }
  }

  private extractUserToKick(messageText: string, groupId: string): string | null {
    const parts = messageText.split(' ');
    return parts.length > 1 ? parts[1] : null;
  }

  private async getUserIdAndCheckAdmin(userToKick: string, groupId: string) {
    const { id: userIdToKick, isAdmin } = await this.findUserIdBasedOnNickname(userToKick, groupId);
    return { userIdToKick: userIdToKick.toString(), isAdmin };
  }

  private async waitForPollResultsAndTakeAction(
    pollId: number,
    userToKick: string,
    userIdToKick: string,
    groupId: string,
  ) {
    const getPollResults = async (pollId: number) => {
      try {
        const results = await this.getPollResults(pollId, groupId) as PollResults;

        if (results.updates[0].results?.results) {
          const yesResults = results.updates[0].results.results[0]?.voters || 0;
          const noResults = results.updates[0].results.results[1]?.voters || 0;

          if (yesResults > noResults) {
            await this.sendMessage({
              peer: groupId,
              message: `${translations['votekickPass']} ${userToKick}!`,
            });
            await this.banUsers([userIdToKick], groupId);
            // Unexpected error: [GoogleGenerativeAI Error]: First content should be with role 'user', got model
            // await insertToMessages({ role: 'model', parts: [{ text: `User ${userToKick} kicked from the group.` }] });
          } else {
            await this.sendMessage({
              peer: groupId,
              message: `${userToKick} ${translations['votekickFailed']}`,
            });
          }
          return;
        }

        setTimeout(async () => {
          await getPollResults(pollId);
        }, POLL_TIMEOUT_MS);
      } catch (error) {
        await this.handleError(groupId, error);
      }
    };

    await getPollResults(pollId);
  }

  async getUsernameIdIsAdmin(groupId: string, limit = 3000) {
    const userEntities = [];
    for await (const user of this.client.iterParticipants(`-${groupId}`, { limit })) {
      const userId = (user.id as any).value as string;
      const userNameId = {
        user: user.username,
        id: userId,
        isAdmin: (user as any).participant?.adminRights ? true : false,
      };
      userEntities.push(userNameId);
    }
    return userEntities;
  }

  async printUserEntities(msgData: MessageData, limit = 3000) {
    const { groupId } = msgData;
    const userEntities = ['Name; Username; ID; Telegram Premium'];
    for await (const user of this.client.iterParticipants(`-${groupId}`, { limit })) {
      const userString = `${user.firstName}; ${user.username}; ${user.id}; ${user.premium}`;
      userEntities.push(userString);
    }
    await this.sendMessage({
      peer: groupId,
      message: `${userEntities.join('\n')}`,
    });
  }

  async findUserIdBasedOnNickname(username: string, groupId: string, limit = 3000) {
    try {
      username = username.split('@')[1];
      const users = await this.getUsernameIdIsAdmin(groupId, limit);

      for (const user of users) {
        if (user.user === username) {
          return { id: user.id, isAdmin: user.isAdmin };
        }
      }
      throw new Error(`User with nickname ${username} not found.`);
    } catch (error) {
      throw new Error(`Couldn't find user: ${error}`);
    }
  }

  async getPollResults(pollMessageId: number, groupId: string) {
    try {
      const pollResults = await this.client.invoke(
        new Api.messages.GetPollResults({
          peer: groupId,
          msgId: pollMessageId,
        }),
      );
      return pollResults;
    } catch (error) {
      console.error('Error retrieving poll results:', error);
      throw error;
    }
  }

  async executeCommand(msgData: MessageData): Promise<boolean> {
    const { messageText } = msgData;
    const commandMappings: any = {
      '/recap': (messageText: string) => this.handleRecapCommand(msgData),
      '/clear': () => this.handleClearCommand(msgData),
      '/scan': () => this.removeLurkers(msgData),
      '/votekick': (messageText: string) => this.processVoteKick(msgData),
      '/users': () => this.printUserEntities(msgData),
    };

    for (const command in commandMappings) {
      if (messageText.includes(command)) {
        await commandMappings[command](messageText);
        return true;
      }
    }
    return false;
  }

  async processMention(msgData: MessageData): Promise<void> {
    if (await this.checkReplyIdIsBotId(msgData)) {
      await this.handleReplyToBotMessage(msgData);
      return;
    }

    if (this.isBotMentioned(msgData)) {
      await this.handleBotMention(msgData);
      return;
    }
  }

  private isBotMentioned(msgData: MessageData): boolean {
    const { messageText } = msgData;
    return messageText.includes(BOT_USERNAME);
  }

  private async handleBotMention(msgData: MessageData) {
    const { replyToMsgId, messageText, image } = msgData;
    // console.log('handleBotMention', { replyToMsgId, image });
    if (replyToMsgId || image) {
      await this.getMessageContentById(msgData);
    }
    /*     console.log('handleBotMention', {
      filepath: msgData.filepath,
      replyMessageContent: msgData.replyMessageContent,
      replyMessageText: msgData.replyMessageText,
    }); */
    await this.processMessage(msgData);
  }

  async getUsers(users: string[]): Promise<Api.User[]> {
    try {
      const response = await this.client.invoke(
        new Api.users.GetUsers({
          id: users,
        }),
      );
      const filteredUsers = response.filter((user): user is Api.User =>
        user.className === 'User' && 'firstName' in user
      );
      return filteredUsers;
    } catch (error: any) {
      throw new Error('Failed to get users: ' + error.message);
    }
  }

  async processSpecialTreatment(firstName: string, messageData: MessageData) {
    const randomNumber = Math.random() * 100;
    if (randomNumber < RANDOM_REPLY_PERCENT) {
      const { groupId, messageId, userEntity } = messageData;
      const request = await this.getUserRecentMessages({ groupId, userEntity, firstName });
      const botResponse = await generateGenAIResponse(request);
      try {
        await this.client.sendMessage(`-${groupId}`, { message: botResponse, replyTo: messageId });
      } catch (error: any) {
        throw Error(error);
      }
    }
  }

  async getUserRecentMessages(data: QueryDataToGetUserMessages) {
    const { groupId, userEntity, firstName, limit, offsetDate } = data;
    const lastUserMessages = await this.getMessagesV2(groupId, {
      limit: limit || 5,
      offsetDate: offsetDate || Date.now() - 3 * 60 * 1000,
      fromUser: userEntity,
    });
    let messages: string[] | string = this.stripUsernames(lastUserMessages);
    messages = messages.join(', ');
    return `${firstName}: ${messages}`;
  }

  private stripUsernames(messages: string[]): string[] {
    return messages.map(message => {
      const colonIndex = message.indexOf(': ');
      if (colonIndex !== -1) {
        return message.slice(colonIndex + 2);
      }
      return message;
    });
  }
  async transcribeMedia(groupId: string, messageId: number) {
    const transcribedAudio = await this.waitForTranscription(messageId, groupId);
    if (transcribedAudio) {
      throw Error('Enable and fix line below.');
      // await this.processMessage(transcribedAudio, groupId);
    }
  }
}
