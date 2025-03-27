import { MESSAGE_LIMIT, recapTextRequest } from '@app/config';
import { generateRecapResponse } from '@app/modules/google/api';
import { clearMessagesTable, filterMessages } from '@app/utils/helper';
import { extractNumber, validateMsgLimit } from '@app/utils/helper';
import translations from '@app/utils/translation';
import type { TelegramBot } from '@app/bot/telegram-bot';

export class CommandHandler {
	constructor(private bot: TelegramBot) {}

	async handleClearCommand(msgData: MessageData): Promise<void> {
		await clearMessagesTable();
		await this.bot.client.sendMessage(`-${msgData.groupId}`, { message: translations.historyCleared });
	}

	async handleRecapCommand(msgData: MessageData, originalMessageIsRequest = false, useRecapModel = true): Promise<void> {
		const { messageText, groupId } = msgData;
		try {
			const msgLimit = extractNumber(messageText) || Number.parseInt(messageText.split(' ')[1]) || 100;

			const msgLimitMatch = await validateMsgLimit(msgLimit);
			if (!msgLimitMatch) {
				await this.bot.client.sendMessage(`-${groupId}`, {
					message: `${translations.recapLimit} ${MESSAGE_LIMIT}: /recap ${MESSAGE_LIMIT}`,
				});
				return;
			}

			const request = originalMessageIsRequest ? messageText : recapTextRequest;

			let messages = await this.bot.messageProcessor.getMessages(groupId, { limit: msgLimit });
			messages = await filterMessages(messages);
			const response = await generateRecapResponse(request, messages, useRecapModel);

			await this.bot.client.sendMessage(`-${groupId}`, { message: response });
		} catch (error) {
			await this.bot.errorHandler.handleError(groupId, error as Error);
		}
	}

	async executeCommand(msgData: MessageData): Promise<boolean> {
		const { messageText } = msgData;
		const commandMappings: CommandMappings = {
			// '/debug': () => this.debug(msgData),
			'/recap': () => this.handleRecapCommand(msgData),
			'/clear': () => this.handleClearCommand(msgData),
			'/q': () => this.bot.processRawRequest(msgData),
			'/votekick': () => this.bot.pollManager.processVoteKick(msgData),
			'/scan': () => this.bot.userManager.removeLurkers(msgData),
			'/users': () => this.bot.userManager.printUserEntities(msgData),
		};

		for (const command in commandMappings) {
			if (messageText.includes(command)) {
				await commandMappings[command](messageText);
				return true;
			}
		}
		return false;
	}
}
