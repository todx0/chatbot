import { BOT_USERNAME, MESSAGE_LIMIT, POLL_TIMEOUT_MS, RANDOM_REPLY_PERCENT, recapTextRequest } from '@app/config';
import { ErrorHandler } from '@app/errors/ErrorHandler';
import {
  generateGenAIResponse,
  generateRawGenAIResponse,
  generateReplyFromImageResponse,
  generateResponseFromImage,
  returnCombinedAnswerFromMultipleResponses,
} from '@app/modules/google/api';
import {
  approximateTokenLength,
  clearMessagesTable,
  convertToImage,
  downloadFile,
  filterMessages,
  getDataFromEvent,
  messageNotSeen,
  retry,
  splitMessageInChunks,
} from '@app/utils/helper';
import { extractNumber } from '@app/utils/helper';
import translations from '@app/utils/translation';
import bigInt from 'big-integer';
import { Api, TelegramClient } from 'telegram';
import { IterMessagesParams } from 'telegram/client/messages';

const { BOT_ID } = Bun.env;

export default class TelegramBot {
  private readonly client: TelegramClient;

  constructor(client: TelegramClient) {
    this.client = client;
  }

  // To delete. Use client.sendMessage
  async sendMessage(obj: SendMessageParams): Promise<Api.TypeUpdates | undefined> {
    const sendMsg = new Api.messages.SendMessage(obj);
    const result = await this.client.invoke(sendMsg);
    return result;
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

  /*   async getMessages(limit: number, groupId: string): Promise<string[]> {
    const messages: string[] = [];
    for await (const message of this.client.iterMessages(`-${groupId}`, { limit })) {
      if (message._sender?.firstName) {
        const sender = message._sender.firstName;
        const messageText = message.message;
        messages.push(`${sender}: ${messageText}`);
      }
    }
    return messages.reverse();
  } */

  async getMessagesV2(
    groupId: string,
    iterParams: Partial<IterMessagesParams> | undefined,
  ): Promise<string[]> {
    const messages: string[] = [];

    for await (const message of this.client.iterMessages(`-${groupId}`, iterParams)) {
      const messageDateMS = message.date * 1000;

      if (message._sender?.firstName) {
        if (!iterParams?.offsetDate || iterParams.offsetDate < messageDateMS) {
          messages.push(`${message._sender.firstName}: ${message.message}`);
        }
      }
    }
    return messages.reverse();
  }

  async handleClearCommand(msgData: MessageData): Promise<void> {
    await clearMessagesTable();
    await this.client.sendMessage(`-${msgData.groupId}`, { message: translations['historyCleared'] });
  }

  async handleRecapCommand(
    msgData: MessageData,
    originalMessageIsRequest = false,
    useRecapModel = true,
  ): Promise<void> {
    const { messageText, groupId } = msgData;
    try {
      const msgLimit = extractNumber(messageText) || parseInt(messageText.split(' ')[1]) || 100;

      const msgLimitMatch = await this.validateMsgLimit(msgLimit);
      if (!msgLimitMatch) {
        await this.client.sendMessage(`-${groupId}`, {
          message: `${translations['recapLimit']} ${MESSAGE_LIMIT}: /recap ${MESSAGE_LIMIT}`,
        });
        return;
      }

      const request = originalMessageIsRequest ? messageText : recapTextRequest;

      let messages = await this.getMessagesV2(groupId, { limit: msgLimit });
      messages = await filterMessages(messages);
      const response = await this.generateRecapResponse(request, messages, useRecapModel);

      await this.client.sendMessage(`-${groupId}`, { message: response });
    } catch (error) {
      await this.handleError(groupId, error as Error);
    }
  }

  async validateMsgLimit(msgLimit: number, recapLimit = 500): Promise<boolean> {
    if (Number.isNaN(msgLimit)) msgLimit = recapLimit;
    if (msgLimit > MESSAGE_LIMIT) return false;
    return true;
  }

  async generateRecapResponse(
    recapTextRequest: string,
    filteredMessages: string[],
    useRecapModel = true,
  ): Promise<string> {
    const MAX_TOKEN_LENGTH = 4096;
    try {
      const messagesLength = await approximateTokenLength(filteredMessages);
      let response: string;

      if (messagesLength <= MAX_TOKEN_LENGTH) {
        filteredMessages.pop();
        const messageString = filteredMessages.join(' ');
        const userRequest = `
        **Task:**
        ${recapTextRequest}
        
        **Context:**
        ${messageString}
        `;
        response = await generateGenAIResponse(userRequest, useRecapModel);
      } else {
        const messageString = filteredMessages.join('; ');
        const chunks = await splitMessageInChunks(messageString);
        response = await returnCombinedAnswerFromMultipleResponses(chunks);
      }

      if (response.length > MAX_TOKEN_LENGTH) {
        response = await generateGenAIResponse(
          `Edit this message to be less than or equal to ${MAX_TOKEN_LENGTH} characters: ${response}`,
          useRecapModel,
        );
      }

      return response;
    } catch (error) {
      console.error('Error generating recap response:', error);
      throw error;
    }
  }

  async handleError(peer: string, error: Error, throwError = true): Promise<void | string> {
    await this.client.sendMessage(`-${peer}`, { message: String(error) });
    return ErrorHandler.handleError(error, throwError);
  }

  async downloadAndSendImageFromUrl(url: string, groupId: string): Promise<void> {
    const buffer = await downloadFile(url);
    const imagePath = await convertToImage(buffer);
    await this.client.sendMessage(groupId, { file: imagePath });
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
    const message: any = await this.client.getMessages(msgData.groupId, { ids: msgData.replyToMsgId, limit: 1 });
    const [msg] = message;
    msgData.dataFromGetMessages = msg;
    await this.setFilepathIfMedia(msgData);
    msgData.replyMessageText = msg.message;
  }

  async setFilepathIfMedia(msgData: any): Promise<void> {
    const msg = msgData.dataFromGetMessages || msgData.message;

    if (msg.media?.document) {
      const stickerBuffer = await this.getStickerBuffer(msgData);
      msgData.filepath = await convertToImage(stickerBuffer, './images/sticker.jpeg');
    }
    if (msg.media?.photo) {
      const imageBuffer = await this.getImageBuffer(msgData);
      msgData.filepath = await convertToImage(imageBuffer as Buffer, './images/image.jpeg');
    }
  }

  async refreshFileReference(msgData: MessageData) {
    const message = await this.client.getMessages(msgData.groupId.toString(), { ids: msgData.replyToMsgId, limit: 1 });
    if (!message || message.length === 0) {
      throw new Error('Message not found');
    }
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

    const fileInput = new Api.InputPhotoFileLocation({
      id: photo.id,
      accessHash: photo.accessHash,
      fileReference: photo.fileReference,
      thumbSize: 'y',
    });
    const params = {
      dcId: photo.dcId,
    };
    const buffer: Buffer = await this.getFileWithRetry(msgData, fileInput, params);

    return buffer;
  }

  async getStickerBuffer(msgData: MessageData): Promise<Buffer> {
    const { document } = msgData?.dataFromGetMessages?.media || msgData?.message?.media;
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
    if (!msgData.replyToMsgId || !msgData.groupId) return false;
    try {
      const messages = await this.client.getMessages(msgData.groupId.toString(), { ids: msgData.replyToMsgId });
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

    let response;
    if (filepath) {
      response = await generateResponseFromImage(msgData);
      response = await generateReplyFromImageResponse(response);
    } else {
      const message = replyMessageText && messageText
        ? `Reply to "${messageText}" Keep context of this message: "${replyMessageText}"`
        : replyMessageText || messageText;
      response = await generateGenAIResponse(message);
    }
    try {
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
      await this.client.sendMessage(`-${groupId}`, { message: translations['lurkersAllGood'] });
    } else {
      await this.client.sendMessage(`-${groupId}`, { message: translations['lurkersBye'] });
      await this.banUsers(usersIdToDelete, groupId);
    }
  }

  async processVoteKick(msgData: MessageData) {
    const { groupId } = msgData;
    try {
      const userToKick = this.extractUserToKick(msgData.messageText, groupId);
      if (!userToKick) {
        await this.client.sendMessage(`-${groupId}`, { message: translations['specifyUserToKick'] });
        return;
      }

      if (userToKick === BOT_USERNAME) {
        await this.client.sendMessage(`-${groupId}`, { message: translations['cantKickThisBot'] });
        return;
      }

      const { userIdToKick, isAdmin } = await this.getUserIdAndCheckAdmin(userToKick, groupId);
      if (!userIdToKick) {
        await this.client.sendMessage(`-${groupId}`, { message: translations['userNotFound'] });
        return;
      }

      if (isAdmin) {
        await this.client.sendMessage(`-${groupId}`, { message: translations['cantKickAdmin'] });
        return;
      }

      const pollMessage = await this.sendPollToKick(userToKick, groupId) as PollMessage;

      const pollMessageId = pollMessage.updates[0].id;

      await this.waitForPollResultsAndTakeAction(pollMessageId, userToKick, userIdToKick, groupId);
    } catch (error) {
      await this.handleError(groupId, error as Error);
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
            await this.client.sendMessage(`-${groupId}`, { message: `${translations['votekickPass']} ${userToKick}!` });
            await this.banUsers([userIdToKick], groupId);
            // Unexpected error: [GoogleGenerativeAI Error]: First content should be with role 'user', got model
            // await insertToMessages({ role: 'model', parts: [{ text: `User ${userToKick} kicked from the group.` }] });
          } else {
            await this.client.sendMessage(`-${groupId}`, {
              message: `${userToKick} ${translations['votekickFailed']}`,
            });
          }
          return;
        }

        setTimeout(async () => {
          await getPollResults(pollId);
        }, POLL_TIMEOUT_MS);
      } catch (error) {
        await this.handleError(groupId, error as Error);
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
    await this.client.sendMessage(`-${groupId}`, { message: `${userEntities.join('\n')}` });
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

  async processRawRequest(msgData: MessageData): Promise<void> {
    const { messageText, groupId } = msgData;
    try {
      const response = await generateRawGenAIResponse(messageText);
      await this.client.sendMessage(`-${groupId}`, { message: response });
    } catch (error) {
      await this.handleError(groupId, error as Error);
    }
  }

  /*
  async debug(msgData: MessageData) {
  }
  */

  async executeCommand(msgData: MessageData): Promise<boolean> {
    const { messageText } = msgData;
    const commandMappings: CommandMappings = {
      // '/debug': () => this.debug(msgData),
      '/q': () => this.processRawRequest(msgData),
      '/recap': () => this.handleRecapCommand(msgData),
      '/votekick': () => this.processVoteKick(msgData),
      '/clear': () => this.handleClearCommand(msgData),
      '/scan': () => this.removeLurkers(msgData),
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
      await this.setFilepathIfMedia(msgData);
      await this.processMessage(msgData);
      return;
    }

    if (msgData.messageText.includes(BOT_USERNAME)) {
      if (msgData.replyToMsgId || msgData.image) {
        await this.getMessageContentById(msgData);
        await this.processMessage(msgData);
      } else {
        await this.handleRecapCommand(msgData, true, false);
      }
      return;
    }
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

  async processRandomReply(msgData: MessageData) {
    const randomNumber = Math.random() * 100;
    if (randomNumber < RANDOM_REPLY_PERCENT) {
      if (!msgData.user.firstName) throw Error('No user.firstName in messageData');
      const request = await this.getUserRecentMessages({
        groupId: msgData.groupId,
        userEntity: msgData.userEntity,
        firstName: msgData.user.firstName,
      });
      const botResponse = await generateGenAIResponse(request);
      try {
        await this.client.sendMessage(`-${msgData.groupId}`, { message: botResponse, replyTo: msgData.messageId });
      } catch (error: any) {
        throw Error(error);
      }
    }
  }

  async getUserRecentMessages(data: QueryDataToGetUserMessages): Promise<string> {
    const lastUserMessages = await this.getMessagesV2(data.groupId, {
      limit: data.limit || 10,
      offsetDate: data.offsetDate || Date.now() - 1 * 60 * 1000,
      fromUser: data.userEntity,
    });
    let messages: string[] | string = this.stripUsernames(lastUserMessages);
    messages = messages.join(', ');

    return `${data.firstName}: ${messages}`;
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
  async transcribeMedia(msgData: MessageData) {
    const transcribedAudio = await this.waitForTranscription(msgData.messageId, msgData.groupId);
    if (transcribedAudio) {
      throw Error('Enable and fix line below.');
      // await this.processMessage(transcribedAudio, groupId);
    }
  }

  async prepareMsgData(event: Api.TypeUpdate): Promise<MessageData | null> {
    const basicMsgData = getDataFromEvent(event);
    if (!basicMsgData.groupId || !basicMsgData.message || !messageNotSeen(basicMsgData.message)) return null;
    const [user] = await this.getUsers([basicMsgData.userEntity]);

    return {
      ...basicMsgData,
      user,
    };
  }
}
