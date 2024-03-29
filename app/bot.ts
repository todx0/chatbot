import { Api } from 'telegram';
import {
	SendMessageParams,
} from './types';
import {
	botUsername,
	messageLimit,
	maxTokenLength,
	recapTextRequest,
} from './config';
import {
	retry,
	downloadFile,
	filterMessages,
	convertToImage,
	insertToMessages,
	clearMessagesTable,
	splitMessageInChunks,
	approximateTokenLength,
} from './helper';
import {
	generateGenAIResponse,
	returnCombinedAnswerFromMultipleResponses,
} from './modules/google/api';

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

	// obj: SendMessageParams
	async sendMessage(obj: any): Promise<Api.TypeUpdates | undefined> {
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

	async handleRecapCommand(messageText: string): Promise<void> {
		const msgLimit = parseInt(messageText.split(' ')[1]);

		if (Number.isNaN(msgLimit)) {
			const obj = { peer: this.groupId, message: '/recap command requires a limit: /recap 50' };
			await this.sendMessage(obj);
			return;
		}

		if (msgLimit > messageLimit) {
			await this.sendMessage({ peer: this.groupId, message: `Max recap limit is ${messageLimit}: /recap ${messageLimit}` });
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
		} catch (error) {
		  await this.sendMessage({ peer: this.groupId, message: String(error) });
		  throw error;
		}
	}

	/* 	async handleImgCommand(messageText: string): Promise<void> {
		const [, requestText] = messageText.split('/img ');

		if (!requestText) {
			await this.sendMessage({
				peer: this.groupId,
				message: '/img command requires a prompt',
			});
			return;
		}
		try {
			const url = await createImageFromPrompt(requestText);
			if (!url.includes('https://')) return;
			await this.downloadAndSendImageFromUrl(url);
		} catch (error) {
			await this.sendMessage({
				peer: this.groupId,
				message: String(error),
			});
			throw error;
		}
	}

	async handleImagineCommand(messageText: string): Promise<void> {
		const msgLimit = parseInt(messageText.split(' ')[1]);
		if (Number.isNaN(msgLimit)) {
			await this.sendMessage({
				peer: this.groupId,
				message: '/imagine command requires a limit: /imagine 50',
			});
			return;
		}
		if (msgLimit > messageLimit) {
			await this.sendMessage({
				peer: this.groupId,
				message: `Max imagine limit is ${messageLimit}: /imagine ${messageLimit}`,
			});
			return;
		}
		try {
			const messages = await this.getMessages(msgLimit);
			const filteredMessages = filterMessages(messages);
			const recapText = await generateGptResponse(`${recapTextRequest} ${filteredMessages}`);
			const url = await createImageFromPrompt(recapText);
			await this.downloadAndSendImageFromUrl(url);
		} catch (error) {
			await this.sendMessage({
				peer: this.groupId,
				message: String(error),
			});
			throw error;
		}
	} */

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

	async processMessage(messageText: string, messageId: any, history = true): Promise<void> {
		let message = messageText.replace(botUsername, '');
		if (history) {
			message = await generateGenAIResponse(message);
		}
		try {
			// no idea why my sendMessage is working only for channels but not groups. Using raw function.
			await this.client.sendMessage(`-${this.groupId}`, { message });
		} catch (e) {
			throw Error(`Not working. ${e}`);
		}
	}

	// TODO: remove comments, debug stuff and split
	async removeLurkers(limit = 3000) {
		// const debugSenders = new Set();
		// const debugParticipants = new Set();

		// get people who sent a message to chat
		const uniqSenders = new Set();
		for await (const message of this.client.iterMessages(`-${this.groupId}`, { limit })) {
			if (message._sender?.id?.value) {
				const value = String(message._sender.id.value);
				// console.log('Sender entity:', `${message._sender.username.toLowerCase()}: ${value}`);
				if (message._sender.username !== 'groupanonymousbot') {
					uniqSenders.add(value);
					// debugSenders.add(`${message._sender.username.toLowerCase()}: ${value}`);
				}
			}
		}
		// get all chat participants
		const uniqUsers = new Set();
		const userEntities = [];
		for await (const user of this.client.iterParticipants(`-${this.groupId}`, { limit })) {
			const userNameId = { user: user.username, id: String(user.id.value) };
			// console.log(userNameId.user, userNameId.id);
			userEntities.push(userNameId);
		}
		userEntities.forEach((userEntity: any) => {
			const userId = userEntity.id;
			const userName = userEntity.user;
			if (userId && !userId.includes('-') && userName !== 'channel_bot' && userId !== BOT_ID) {
				// debugParticipants.add(`${userName}: ${userId}`);
				uniqUsers.add(userId);
			}
		});

		const intersection = new Set([...uniqUsers].filter((value) => !uniqSenders.has(value)));
		const usersIdToDelete = [...intersection];

		// const debugintersection = new Set([...debugParticipants].filter((value) => !debugSenders.has(value)));

		// console.log('debug senders:', debugSenders);
		// console.log('debug participants:', debugParticipants);
		// console.log('debug intersection', debugintersection);
		// console.log('original intersection:', intersection);

		if (usersIdToDelete.length) {
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
			} catch (e) {
				throw Error(`Error deleting users. Error: ${e}`);
			}
		});
	}

	async fetchAndInsertMessages(limit: number): Promise<void> {
		const messages = await this.getMessages(limit);
		messages.forEach((message) => insertToMessages({ role: 'user', parts: message }));
	}
}
