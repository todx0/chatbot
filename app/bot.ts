import bigInt from 'big-integer';
import { Api } from 'telegram';
import { botUsername, maxTokenLength, messageLimit, pollTimeoutMs, recapTextRequest } from './config';
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

  async sendPollToKick(user: string) {
    const poll = new Api.InputMediaPoll({
      poll: new Api.Poll({
        id: bigInt(Math.floor(Math.random() * 0xFFFFFFFFFFFFFFF)),
        question: `Kick ${user}?`,
        answers: [
          new Api.PollAnswer({
            text: 'yes',
            option: Buffer.from('1'),
          }),
          new Api.PollAnswer({
            text: 'no',
            option: Buffer.from('2'),
          }),
        ],
        closed: false,
        publicVoters: false,
        multipleChoice: false,
        quiz: false,
        closePeriod: pollTimeoutMs / 1000,
        closeDate: Math.floor(Date.now() / 1000) + pollTimeoutMs / 1000,
      }),
    });

    const message = await this.client.invoke(
      new Api.messages.SendMedia({
        peer: this.groupId,
        media: poll,
        message: '',
        randomId: bigInt(Math.floor(Math.random() * 0xFFFFFFFFFFFFFFF)),
      }),
    );
    return message;
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

  async handleRecapCommand(messageText: string): Promise<void> {
    try {
      const msgLimit = parseInt(messageText.split(' ')[1]);

      await this.validateMsgLimit(msgLimit);
      const messages = await this.retrieveAndFilterMessages(msgLimit);
      const response = await this.generateRecapResponse(messages);

      await this.sendMessage({ peer: this.groupId, message: response });
    } catch (error) {
      await this.handleError(this.groupId, error);
    }
  }

  async validateMsgLimit(msgLimit: number): Promise<void> {
    if (Number.isNaN(msgLimit)) {
      throw new Error('/recap command requires a limit: /recap 50');
    }

    if (msgLimit > messageLimit) {
      throw new Error(`Max recap limit is ${messageLimit}: /recap ${messageLimit}`);
    }
  }

  async retrieveAndFilterMessages(msgLimit: number): Promise<string[]> {
    const messages = await this.getMessages(msgLimit);
    return filterMessages(messages);
  }

  async generateRecapResponse(filteredMessages: string[]): Promise<string> {
    const messagesLength = await approximateTokenLength(filteredMessages);

    if (messagesLength <= maxTokenLength) {
      const messageString = filteredMessages.join(' ');
      return generateGenAIResponse(`${recapTextRequest} ${messageString}`);
    } else {
      const chunks = await splitMessageInChunks(filteredMessages.join(' '));
      return returnCombinedAnswerFromMultipleResponses(chunks);
    }
  }

  async handleError(peer: string, error: any): Promise<void | string> {
    await this.sendMessage({ peer, message: String(error) });
    return ErrorHandler.handleError(error, true);
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

  async getUniqSenders(limit: number): Promise<Set<string>> {
    const uniqSenders = new Set<string>();
    for await (const message of this.client.iterMessages(`-${this.groupId}`, { limit })) {
      if (message._sender?.id?.value) {
        const value = String(message._sender.id.value);
        uniqSenders.add(value);
      }
    }
    return uniqSenders;
  }

  async getUniqUsers(limit: number): Promise<Set<string>> {
    const uniqUsers = new Set<string>();
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
    return uniqUsers;
  }

  async banUsers(usersIdToDelete: string[]): Promise<void | string> {
    for (const userId of usersIdToDelete) {
      try {
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
    }
  }

  async removeLurkers(limit = 3000): Promise<void> {
    const uniqSenders = await this.getUniqSenders(limit);
    const uniqUsers = await this.getUniqUsers(limit);

    const intersection = new Set([...uniqUsers].filter((value) => !uniqSenders.has(value)));
    const usersIdToDelete = [...intersection];

    if (!usersIdToDelete.length) {
      await this.sendMessage({
        peer: this.groupId,
        message: 'Все молодцы',
      });
    } else {
      await this.sendMessage({
        peer: this.groupId,
        message: 'Пошли нахуй:',
      });
      await this.banUsers(usersIdToDelete);
    }
  }

  async processVoteKick(messageText: string) {
    try {
      const userToKick = this.extractUserToKick(messageText);
      if (!userToKick) {
        await this.sendMessage({
          peer: this.groupId,
          message: 'Please specify user to kick.',
        });
        return;
      }

      if (userToKick === botUsername) {
        await this.sendMessage({
          peer: this.groupId,
          message: 'Хуй тебе в нос!',
        });
        return;
      }

      const { userIdToKick, isAdmin } = await this.getUserIdAndCheckAdmin(userToKick);
      if (!userIdToKick) {
        await this.sendMessage({
          peer: this.groupId,
          message: 'User not found.',
        });
        return;
      }

      if (isAdmin) {
        await this.sendMessage({
          peer: this.groupId,
          message: 'Cannot kick an admin.',
        });
        return;
      }

      const pollMessage = await this.sendPollToKick(userToKick);
      const pollMessageId = pollMessage.updates[0].id;

      await this.waitForPollResultsAndTakeAction(pollMessageId, userToKick, userIdToKick);
    } catch (error) {
      await this.handleError(this.groupId, error);
    }
  }

  private extractUserToKick(messageText: string): string | null {
    const parts = messageText.split(' ');
    return parts.length > 1 ? parts[1] : null;
  }

  private async getUserIdAndCheckAdmin(userToKick: string) {
    const { id: userIdToKick, isAdmin } = await this.findUserIdBasedOnNickname(userToKick);
    return { userIdToKick: userIdToKick.toString(), isAdmin };
  }

  private async waitForPollResultsAndTakeAction(pollId: number, userToKick: string, userIdToKick: string) {
    const getPollResults = async (pollId: number) => {
      try {
        const results = await this.getPollResults(pollId);

        if (results.updates[0].results?.results) {
          const yesResults = results.updates[0].results.results[0]?.voters || 0;
          const noResults = results.updates[0].results.results[1]?.voters || 0;

          if (yesResults > noResults) {
            await this.sendMessage({
              peer: this.groupId,
              message: `Пошел нахуй ${userToKick}!`,
            });
            await this.banUsers([userIdToKick]);
            await insertToMessages({ role: 'model', parts: [{ text: `User ${userToKick} kicked from the group.` }] });
          } else {
            await this.sendMessage({
              peer: this.groupId,
              message: `${userToKick} остается.`,
            });
          }
          return;
        }

        setTimeout(async () => {
          await getPollResults(pollId);
        }, pollTimeoutMs);
      } catch (error) {
        await this.handleError(this.groupId, error);
      }
    };

    await getPollResults(pollId);
  }

  async getUsernameIdIsAdmin(limit = 3000) {
    const userEntities = [];
    for await (const user of this.client.iterParticipants(`-${this.groupId}`, { limit })) {
      const userNameId = {
        user: user.username,
        id: String(user.id.value),
        isAdmin: user.participant.adminRights ? true : false,
      };
      userEntities.push(userNameId);
    }
    return userEntities;
  }

  async printUserEntities(limit = 3000) {
    const userEntities = [];
    for await (const user of this.client.iterParticipants(`-${this.groupId}`, { limit })) {
      const userString = `${user.firstName}; ${user.username}; ${user.id}; premium: ${user.premium};`;
      userEntities.push(userString);
    }
    await this.sendMessage({
      peer: this.groupId,
      message: `${userEntities.join('\n')}`,
    });
  }

  async findUserIdBasedOnNickname(username: string, limit = 3000) {
    try {
      username = username.split('@')[1];
      const users = await this.getUsernameIdIsAdmin(limit);

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

  async getPollResults(pollMessageId: number) {
    try {
      const pollResults = await this.client.invoke(
        new Api.messages.GetPollResults({
          peer: this.groupId,
          msgId: pollMessageId,
        }),
      );
      return pollResults;
    } catch (error) {
      console.error('Error retrieving poll results:', error);
      throw error;
    }
  }

  async fetchAndInsertMessages(limit: number): Promise<void> {
    const messages = await this.getMessages(limit);
    messages.forEach((message) => insertToMessages({ role: 'user', parts: [{ text: message }] }));
  }
}
