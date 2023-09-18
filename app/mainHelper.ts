import { Api } from 'telegram';
import {
	SendMessageParams,
} from './types';
import {
	botUsername,
	messageLimit,
	maxTokenLength,
	recapTextRequest,
	toxicRecapRequest,
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
	combineAnswers,
	generateGptResponse,
	generateGptResponses,
	createImageFromPrompt,
	generateGptRespWithHistory,
} from './modules/openai/api';

// use this workaround instead destructuring config because 'bun test' fails otherwise.
const { BOT_ID } = Bun.env;

export default class TelegramBot {
	private readonly client: any;

	private groupId: any;

	constructor(client: any, groupId: any = 0) {
		this.client = client;
		this.groupId = groupId;
	}

	getGroupId(): number {
		return this.groupId;
	}

	setGroupId(newValue: number): void {
		this.groupId = newValue;
	}

	async sendMessage(obj: SendMessageParams): Promise<Api.TypeUpdates | undefined> {
		const {
			peer, message, replyToMsgId, silent
		} = obj;
		const sendMsg = new Api.messages.SendMessage({
			peer,
			message,
			replyToMsgId,
			silent
		});
		const result = await this.client.invoke(sendMsg);
		return result;
	}

	async sendImage(imagePath: string): Promise<Api.Message> {
		return this.client.sendMessage(this.groupId, { file: imagePath });
	}

	async getMessages(limit: number): Promise<string[]> {
		const messages: string[] = [];
		for await (const message of this.client.iterMessages(`-${this.groupId}`, { limit })) {
			messages.push(`${message._sender.firstName}: ${message.message}`);
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
				response = await generateGptResponse(`${recapTextRequest} ${messageString}`);
			} else {
				const chunks = await splitMessageInChunks(filteredMessages.toString());
				if (chunks.length === 1) {
					response = await generateGptResponse(`${recapTextRequest} ${chunks[0]}`);
				} else {
					const responses = await generateGptResponses(recapTextRequest, chunks);
					const responsesCombined = await combineAnswers(responses);
					response = await generateGptResponse(`${toxicRecapRequest} ${responsesCombined}`);
				}
		  }
		  await this.sendMessage({ peer: this.groupId, message: response });
		} catch (error) {
		  await this.sendMessage({ peer: this.groupId, message: String(error) });
		  throw error;
		}
	}

	async handleQCommand(messageText: string): Promise<void> {
		const [, requestText] = messageText.split('/q ');
		try {
			const response = await generateGptResponse(requestText);
			await this.sendMessage({
				peer: this.groupId,
				message: response
			});
		} catch (error) {
			await this.sendMessage({
				peer: this.groupId,
				message: String(error)
			});
			throw error;
		}
	}

	async handleImgCommand(messageText: string): Promise<void> {
		const [, requestText] = messageText.split('/img ');

		if (!requestText) {
			await this.sendMessage({
				peer: this.groupId,
				message: '/img command requires a prompt'
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
				message: String(error)
			});
			throw error;
		}
	}

	async handleImagineCommand(messageText: string): Promise<void> {
		const msgLimit = parseInt(messageText.split(' ')[1]);
		if (Number.isNaN(msgLimit)) {
			await this.sendMessage({
				peer: this.groupId,
				message: '/imagine command requires a limit: /imagine 50'
			});
			return;
		}
		if (msgLimit > messageLimit) {
			await this.sendMessage({
				peer: this.groupId,
				message: `Max imagine limit is ${messageLimit}: /imagine ${messageLimit}`
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
				message: String(error)
			});
			throw error;
		}
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

	async getMessageContentById(messageId: number): Promise<any> {
		const message = await this.client.getMessages(this.groupId, { ids: messageId });
		return message[0].message;
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

	async processMessage(userRequest: string, messageId: number, history = true): Promise<void> {
		let message = userRequest.replace(botUsername, '');
		message = history ? await generateGptRespWithHistory(message) : message;
		await this.sendMessage({
			peer: this.groupId,
			message,
			replyToMsgId: messageId,
			silent: true
		});
	}

	async fetchAndInsertMessages(limit: number): Promise<void> {
		const messages = await this.getMessages(limit);
		messages.forEach(message => insertToMessages({ role: 'user', content: message }));
	}
}
