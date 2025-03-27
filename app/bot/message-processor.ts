import { generateGenAIResponse, generateReplyFromImageResponse, generateResponseFromImage } from '@app/modules/google/api';
import { getDataFromEvent, messageNotSeen } from '@app/utils/helper';
import { stripBotNameFromMessage, stripUsernames } from '@app/utils/helper';

import type { Api } from 'telegram';
import type { TelegramClient } from 'telegram';
import type { IterMessagesParams } from 'telegram/client/messages';
import type { FileManager } from '@app/bot/file-manager';
import type { UserManager } from '@app/bot/user-manager';

const { BOT_ID } = Bun.env;

export class MessageProcessor {
	constructor(
		private client: TelegramClient,
		private fileManager: FileManager,
		private userManager: UserManager,
	) {}

	async getMessages(groupId: string, iterParams: Partial<IterMessagesParams> | undefined): Promise<string[]> {
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

	async processMessage(msgData: MessageData): Promise<string> {
		if (msgData.messageText) msgData.messageText = stripBotNameFromMessage(msgData.messageText);
		if (msgData.replyMessageText) msgData.replyMessageText = stripBotNameFromMessage(msgData.replyMessageText);
		const { filepath, replyMessageText, messageText, messageId, groupId } = msgData;

		let response: string;
		if (filepath) {
			response = await generateResponseFromImage(msgData);
			response = await generateReplyFromImageResponse(response);
		} else {
			const message =
				replyMessageText && messageText
					? `Reply to "${messageText}" Keep context of this message: "${replyMessageText}"`
					: replyMessageText || messageText;
			response = await generateGenAIResponse(message);
		}
		try {
			await this.client.sendMessage(`-${groupId}`, { message: response, replyTo: messageId });
			return response;
		} catch (error) {
			throw Error(`Failed to process message: ${(error as Error).message}`);
		}
	}

	async getMessageContentById(msgData: MessageData): Promise<void> {
		const message = await this.client.getMessages(msgData.groupId, { ids: msgData.replyToMsgId, limit: 1 });
		const [msg] = message;
		msgData.dataFromGetMessages = msg;
		await this.fileManager.setFilepathIfMedia(msgData);
		msgData.replyMessageText = msg.message;
	}

	async getUserRecentMessages(data: QueryDataToGetUserMessages): Promise<string> {
		const lastUserMessages = await this.getMessages(data.groupId, {
			limit: data.limit || 10,
			offsetDate: data.offsetDate || Date.now() - 1 * 60 * 1000,
			fromUser: data.userEntity,
		});
		let messages: string[] | string = stripUsernames(lastUserMessages);
		messages = messages.join(', ');

		return `${data.firstName}: ${messages}`;
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

	async prepareMsgData(event: Api.TypeUpdate): Promise<MessageData | null> {
		const basicMsgData = getDataFromEvent(event);
		if (!basicMsgData.groupId || !basicMsgData.message || !messageNotSeen(basicMsgData.message)) return null;
		const [user] = await this.userManager.getUsers([basicMsgData.userEntity]);

		return {
			...basicMsgData,
			user,
		};
	}
}
