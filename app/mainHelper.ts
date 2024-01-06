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
import generateGenAIResponse from './modules/google/api';

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

	async sendMessage(obj: SendMessageParams): Promise<Api.TypeUpdates | undefined> {
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
				await this.sendMessage({ peer: this.groupId, message: response });
			} else {
				const chunks = await splitMessageInChunks(filteredMessages.toString());
				chunks.forEach(async (chunk) => {
					// TODO: refactor it because comment bellow
					// this is stupid as chunks may cut conversation in half and produce weird results
					response = await generateGenAIResponse(`${recapTextRequest} ${chunk}`);
					await this.sendMessage({ peer: this.groupId, message: response });
				});
				/*
				Old code where I combine answers using function to generate multiple responses and them combine them again

				if (chunks.length === 1) {
					response = await generateGptResponses(`${recapTextRequest} ${chunks[0]}`);
				} else {
					const responses = await generateGptResponses(recapTextRequest, chunks);
					const responsesCombined = await combineAnswers(responses);
					response = await generateGptResponse(`${toxicRecapRequest} ${responsesCombined}`);
				}
				*/
		  }
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
			await this.sendMessage({
				peer: this.groupId,
				message,
				replyToMsgId: messageId,
				silent: true,
			});
		} catch (e) {
			throw Error(`Not working. ${e}`);
		}
	}

	async fetchAndInsertMessages(limit: number): Promise<void> {
		const messages = await this.getMessages(limit);
		messages.forEach((message) => insertToMessages({ role: 'user', parts: message }));
	}
}
