import { BOT_USERNAME, RANDOM_REPLY_PERCENT } from '@app/config';
import { generateGenAIResponse, generateRawGenAIResponse } from '@app/modules/google/api';
import { MessageProcessor } from '@app/bot/message-processor';
import { PollManager } from '@app/bot/poll-manager';
import { UserManager } from '@app/bot/user-manager';
import { BotErrorHandler } from '@app/bot/bot-error-handler';
import { CommandHandler } from '@app/bot/command-handler';
import { FileManager } from '@app/bot/file-manager';

import type { TelegramClient } from 'telegram';

export class TelegramBot {
	messageProcessor: MessageProcessor;
	pollManager: PollManager;
	userManager: UserManager;
	errorHandler: BotErrorHandler;
	commandHandler: CommandHandler;
	fileManager: FileManager;
	client: TelegramClient;

	constructor(client: TelegramClient) {
		this.client = client;
		this.errorHandler = new BotErrorHandler(client);
		this.userManager = new UserManager(client);
		this.fileManager = new FileManager(client);
		this.pollManager = new PollManager(client, this.userManager, this.errorHandler);
		this.messageProcessor = new MessageProcessor(client, this.fileManager, this.userManager);
		this.commandHandler = new CommandHandler(this);
	}

	async processRawRequest(msgData: MessageData): Promise<void> {
		const { messageText, groupId } = msgData;
		try {
			const response = await generateRawGenAIResponse(messageText);
			await this.client.sendMessage(`-${groupId}`, { message: response });
		} catch (error) {
			await this.errorHandler.handleError(groupId, error as Error);
		}
	}

	async processMention(msgData: MessageData): Promise<void> {
		if (await this.messageProcessor.checkReplyIdIsBotId(msgData)) {
			await this.fileManager.setFilepathIfMedia(msgData);
			await this.messageProcessor.processMessage(msgData);
			return;
		}

		if (msgData.messageText.includes(BOT_USERNAME)) {
			if (msgData.replyToMsgId || msgData.image) {
				await this.messageProcessor.getMessageContentById(msgData);
				await this.messageProcessor.processMessage(msgData);
			} else {
				await this.commandHandler.handleRecapCommand(msgData, true, false);
			}
			return;
		}
	}

	async processRandomReply(msgData: MessageData) {
		const randomNumber = Math.random() * 100;
		if (randomNumber < RANDOM_REPLY_PERCENT) {
			if (!msgData.user.firstName) throw Error('No user.firstName in messageData');
			const request = await this.messageProcessor.getUserRecentMessages({
				groupId: msgData.groupId,
				userEntity: msgData.userEntity,
				firstName: msgData.user.firstName,
			});
			const botResponse = await generateGenAIResponse(request);
			try {
				await this.client.sendMessage(`-${msgData.groupId}`, { message: botResponse, replyTo: msgData.messageId });
			} catch (error) {
				throw Error(`Failed to process random reply: ${(error as Error).message}`);
			}
		}
	}
}
