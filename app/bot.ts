import bigInt from 'big-integer';
import { Api, TelegramClient } from 'telegram';
import { BOT_USERNAME, MAX_TOKEN_LENGTH, MESSAGE_LIMIT, POLL_TIMEOUT_MS, recapTextRequest } from './config';
import { ErrorHandler } from './errors/ErrorHandler';
import {
  generateGenAIResponse,
  generateResponseFromImage,
  returnCombinedAnswerFromMultipleResponses,
} from './modules/google/api';
import { MessageData, MessageObject, PollMessage, PollResults, SendMessageParams } from './types';
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

  async handleClearCommand(groupId: string): Promise<void> {
    await clearMessagesTable();
    await this.sendMessage({
      peer: groupId,
      message: translations['historyCleared'],
    });
  }

  async handleRecapCommand(messageText: string, groupId: string): Promise<void> {
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

  async getMessageContentById(
    messageId: number,
    groupId: string,
  ): Promise<{ mediaContent: string; textContent: string }> {
    const message = await this.client.getMessages(groupId, { ids: messageId, limit: 1 });

    let textContent = '', mediaContent = '';
    const media = message[0]?.media as { photo?: any };

    if (media?.photo) {
      const imageBuffer = await this.getImageBuffer(message);
      mediaContent = await convertToImage(imageBuffer);
    }

    textContent = message[0].message;
    return { mediaContent, textContent };
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
    return buffer as Buffer;
  }

  async checkReplyIdIsBotId(messageId: number, groupId: string): Promise<boolean | string> {
    if (!messageId || !groupId) return false;
    let messages;
    try {
      messages = await this.client.getMessages(groupId, { ids: messageId });
    } catch (error: any) {
      return ErrorHandler.handleError(error, true);
    }
    if (String(messages[0]._senderId) === String(BOT_ID)) {
      return true;
    }
    return false;
  }

  async processMessage(msgObject: MessageObject, groupId: string, replyTo?: number): Promise<void | string> {
    const { replyMessageContent, filePath } = msgObject;
    msgObject.replyMessageContent = this.stripBotNameFromMessage(replyMessageContent);
    let textResponse = '', imageResponse = '';
    let message = '';
    // Need to figure out how to process image when tagging bot under image. He doesn't see it.
    if (filePath?.includes('images')) {
      imageResponse = await generateResponseFromImage(msgObject);
    } else {
      textResponse = await generateGenAIResponse(replyMessageContent);
    }
    try {
      const message = textResponse ? textResponse : imageResponse; // textResponse + imageResponse;
      await this.client.sendMessage(`-${groupId}`, { message, replyTo });
    } catch (error: any) {
      return ErrorHandler.handleError(error, true);
    }
  }

  private stripBotNameFromMessage(message: string): string {
    return message.replace(BOT_USERNAME, '');
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

  async removeLurkers(groupId: string, limit = 3000): Promise<void> {
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

  async processVoteKick(messageText: string, groupId: string) {
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

  async printUserEntities(groupId: string, limit = 3000) {
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

  async fetchAndInsertMessages(limit: number, groupId: string): Promise<void> {
    const messages = await this.getMessages(limit, groupId);
    messages.forEach((message) => insertToMessages({ role: 'user', parts: [{ text: message }] }));
  }

  async executeCommand(messageText: string, groupId: string): Promise<boolean> {
    const commandMappings: Record<string, (msgText: string) => Promise<void | string>> = {
      '/recap': (msgText) => this.handleRecapCommand(msgText, groupId),
      '/clear': () => this.handleClearCommand(groupId),
      '/scan': () => this.removeLurkers(groupId),
      '/votekick': (msgText) => this.processVoteKick(msgText, groupId),
      '/users': () => this.printUserEntities(groupId),
    };

    for (const command in commandMappings) {
      if (messageText.includes(command)) {
        await commandMappings[command](messageText);
        return true;
      }
    }
    return false;
  }

  async processMention(msgData: MessageData) {
    const { replyToMsgId, messageText, groupId, messageId, image, message } = msgData;

    // Auto reply when replying to bot's message.
    if (replyToMsgId && groupId && (await this.checkReplyIdIsBotId(replyToMsgId.replyToMsgId, groupId))) {
      await this.processMessage({ replyMessageContent: messageText }, groupId, messageId);
      return;
    }

    const isBotCalled = messageText.includes(BOT_USERNAME);
    if (isBotCalled) {
      let messageObj: MessageObject = {
        replyMessageContent: messageText,
        image: false,
      };
      if (replyToMsgId) {
        // Bot mentioned with @ under somebody's message
        messageObj.replyMessageContent = '';
        const { textContent, mediaContent } = await this.getMessageContentById(replyToMsgId, groupId);
        messageObj.replyMessageContent = textContent;
        messageObj.filePath = mediaContent;
        await this.processMessage(messageObj, groupId, messageId);
      } else if (image) {
        // Bot responds to image
        const { mediaContent } = await this.getMessageContentById(replyToMsgId, groupId);
        messageObj.filePath = mediaContent;
        await this.processMessage(messageObj, groupId, messageId);
      } else {
        // Bot mentioned with @
        await this.processMessage(messageObj, groupId, messageId);
      }
    }
  }
  async transcribeMedia(groupId: string, messageId: number) {
    const transcribedAudio = await this.waitForTranscription(messageId, groupId);
    if (transcribedAudio) {
      throw Error('Enable and fix line below.');
      // await this.processMessage(transcribedAudio, groupId);
    }
  }
}
