import translations from '@app/utils/translation';
import { Api } from 'telegram';
import type { TelegramClient } from 'telegram';

const { BOT_ID } = Bun.env;

export class UserManager {
	constructor(private client: TelegramClient) {}

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
			const userId = user.id.toString();
			const userNameId = {
				user: user.username,
				id: userId,
			};
			userEntities.push(userNameId);
		}

		for (const entity of userEntities) {
			const userId = entity.id;
			const userName = entity.user;
			if (userId && !(<string>userId).includes('-') && userName !== 'channel_bot' && userId !== BOT_ID) {
				uniqUsers.add(userId);
			}
		}

		return uniqUsers;
	}

	async banUsers(usersIdToDelete: string[], groupId: string): Promise<void> {
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
			} catch (error) {
				throw Error(`Failed to ban users: ${(error as Error).message}`);
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
			await this.client.sendMessage(`-${groupId}`, { message: translations.lurkersAllGood });
		} else {
			await this.client.sendMessage(`-${groupId}`, { message: translations.lurkersBye });
			await this.banUsers(usersIdToDelete, groupId);
		}
	}

	async getUsernameIdIsAdmin(groupId: string, limit = 3000) {
		const userEntities = [];
		for await (const user of this.client.iterParticipants(`-${groupId}`, { limit })) {
			const userId = String(user.id);
			const isAdmin = (user as any).participant?.adminRights;
			const userNameId = {
				user: user.username,
				id: userId,
				isAdmin,
			};
			userEntities.push(userNameId);
		}
		return userEntities;
	}

	async getUserIdAndCheckAdmin(userToKick: string, groupId: string) {
		const { id: userIdToKick, isAdmin } = await this.findUserIdBasedOnNickname(userToKick, groupId);
		return { userIdToKick: userIdToKick.toString(), isAdmin };
	}

	async findUserIdBasedOnNickname(username: string, groupId: string, limit = 3000) {
		try {
			const userNameSplit = username.split('@')[1];
			const users = await this.getUsernameIdIsAdmin(groupId, limit);

			for (const user of users) {
				if (user.user === userNameSplit) {
					return { id: user.id, isAdmin: user.isAdmin };
				}
			}
			throw new Error(`User with nickname ${userNameSplit} not found.`);
		} catch (error) {
			throw new Error(`Couldn't find user: ${error}`);
		}
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

	async getUsers(users: string[]): Promise<Api.User[]> {
		try {
			const response = await this.client.invoke(
				new Api.users.GetUsers({
					id: users,
				}),
			);
			const filteredUsers = response.filter((user): user is Api.User => user.className === 'User' && 'firstName' in user);
			return filteredUsers;
		} catch (error) {
			throw Error(`Failed to get users: ${(error as Error).message}`);
		}
	}
}
