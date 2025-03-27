import { convertToImage, downloadFile } from '@app/utils/helper';
import { Api } from 'telegram';
import type { TelegramClient } from 'telegram';

export class FileManager {
	constructor(private client: TelegramClient) {}

	async downloadAndSendImageFromUrl(url: string, groupId: string): Promise<void> {
		const buffer = await downloadFile(url);
		const imagePath = await convertToImage(buffer);
		await this.client.sendMessage(groupId, { file: imagePath });
	}

	async setFilepathIfMedia(msgData: MessageData): Promise<void> {
		const msg = msgData.dataFromGetMessages || msgData.message;

		if (msg.media?.document) {
			const stickerBuffer = await this.getStickerBuffer(msgData);
			msgData.filepath = await convertToImage(stickerBuffer, './images/sticker.jpeg');
		}
		if (msg.media?.photo) {
			const imageBuffer = await this.getImageBuffer(msgData);
			msgData.filepath = await convertToImage(imageBuffer as Buffer, './images/image.jpeg');
		}
	}

	async getFileWithRetry(
		msgData: MessageData,
		fileInput: Api.InputPhotoFileLocation | Api.InputDocumentFileLocation,
		params: { dcId: number },
		maxRetries = 3,
	): Promise<Buffer> {
		let result: Buffer = Buffer.alloc(0);
		let input = fileInput;

		for (let i = 0; i < maxRetries; i++) {
			try {
				result = (await this.client.downloadFile(fileInput, params)) as Buffer;
			} catch (error) {
				if ((error as Error).message.includes('FILE_REFERENCE_EXPIRED') && i < maxRetries - 1) {
					input = await this.refreshFileReference(msgData);
				} else {
					throw error;
				}
			}
		}
		return result;
	}

	async refreshFileReference(msgData: MessageData) {
		const message = await this.client.getMessages(msgData.groupId.toString(), { ids: msgData.replyToMsgId, limit: 1 });
		if (!message || message.length === 0) {
			throw new Error('Message not found');
		}
		let newFileInput: Api.TypePhoto | Api.TypeDocument;
		if (message[0].photo) {
			newFileInput = message[0].photo;
		} else if (message[0].document) {
			newFileInput = message[0].document;
		} else if (message[0].video) {
			newFileInput = message[0].video;
		} else {
			throw new Error('Unsupported file type');
		}

		return newFileInput;
	}

	async getImageBuffer(msgData: MessageData): Promise<Buffer | undefined> {
		const { photo } = msgData.dataFromGetMessages.media || msgData.message.media;
		if (!photo || photo.className === 'PhotoEmpty') return undefined;

		const fileInput = new Api.InputPhotoFileLocation({
			id: photo.id,
			accessHash: photo.accessHash,
			fileReference: photo.fileReference,
			thumbSize: 'y',
		});
		const params = {
			dcId: photo.dcId,
		};
		const buffer: Buffer = await this.getFileWithRetry(msgData, fileInput, params);

		return buffer;
	}

	async getStickerBuffer(msgData: MessageData): Promise<Buffer> {
		const media = msgData.dataFromGetMessages?.media || msgData.message?.media;
		if (!media?.document) {
			throw new Error('No document found in media');
		}
		const { document } = media;
		const buffer = await this.client.downloadFile(
			new Api.InputDocumentFileLocation({
				id: document.id,
				accessHash: document.accessHash,
				fileReference: document.fileReference,
				thumbSize: '',
			}),
			{
				dcId: document.dcId,
			},
		);
		return buffer as Buffer;
	}
}
