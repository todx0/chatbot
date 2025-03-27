import { BOT_USERNAME, POLL_TIMEOUT_MS } from '@app/config';
import { extractUserToKick } from '@app/utils/helper';
import translations from '@app/utils/translation';
import bigInt from 'big-integer';
import { Api } from 'telegram';

import type { TelegramClient } from 'telegram';
import type { UserManager } from '@app/bot/user-manager';
import type { BotErrorHandler } from '@app/bot/bot-error-handler';

export class PollManager {
	constructor(
		private client: TelegramClient,
		private userManager: UserManager,
		private errorHandler: BotErrorHandler,
	) {}

	async sendPollToKick(user: string, groupId: string) {
		const poll = new Api.InputMediaPoll({
			poll: new Api.Poll({
				id: bigInt(Math.floor(Math.random() * Math.random())),
				question: `${translations.kick} ${user}?`,
				answers: [
					new Api.PollAnswer({
						text: translations.yes,
						option: Buffer.from('1'),
					}),
					new Api.PollAnswer({
						text: translations.no,
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
				randomId: bigInt(Math.floor(Math.random() * Math.random())),
			}),
		);
		return message;
	}

	async processVoteKick(msgData: MessageData) {
		const { groupId } = msgData;
		try {
			const userToKick = extractUserToKick(msgData.messageText);
			if (!userToKick) {
				await this.client.sendMessage(`-${groupId}`, { message: translations.specifyUserToKick });
				return;
			}

			if (userToKick === BOT_USERNAME) {
				await this.client.sendMessage(`-${groupId}`, { message: translations.cantKickThisBot });
				return;
			}

			const { userIdToKick, isAdmin } = await this.userManager.getUserIdAndCheckAdmin(userToKick, groupId);
			if (!userIdToKick) {
				await this.client.sendMessage(`-${groupId}`, { message: translations.userNotFound });
				return;
			}

			if (isAdmin) {
				await this.client.sendMessage(`-${groupId}`, { message: translations.cantKickAdmin });
				return;
			}

			const pollMessage = (await this.sendPollToKick(userToKick, groupId)) as PollMessage;

			const pollMessageId = pollMessage.updates[0].id;

			await this.waitForPollResultsAndTakeAction(pollMessageId, userToKick, userIdToKick, groupId);
		} catch (error) {
			await this.errorHandler.handleError(groupId, error as Error);
		}
	}

	async waitForPollResultsAndTakeAction(pollId: number, userToKick: string, userIdToKick: string, groupId: string) {
		const getPollResults = async (pollId: number) => {
			try {
				const results = (await this.getPollResults(pollId, groupId)) as PollResults;

				if (results.updates[0].results?.results) {
					const yesResults = results.updates[0].results.results[0]?.voters || 0;
					const noResults = results.updates[0].results.results[1]?.voters || 0;

					if (yesResults > noResults) {
						await this.client.sendMessage(`-${groupId}`, { message: `${translations.votekickPass} ${userToKick}!` });
						await this.userManager.banUsers([userIdToKick], groupId);
						// Unexpected error: [GoogleGenerativeAI Error]: First content should be with role 'user', got model
						// await insertToMessages({ role: 'model', parts: [{ text: `User ${userToKick} kicked from the group.` }] });
					} else {
						await this.client.sendMessage(`-${groupId}`, {
							message: `${userToKick} ${translations.votekickFailed}`,
						});
					}
					return;
				}

				setTimeout(async () => {
					await getPollResults(pollId);
				}, POLL_TIMEOUT_MS);
			} catch (error) {
				await this.errorHandler.handleError(groupId, error as Error);
			}
		};

		await getPollResults(pollId);
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
}
