import axios from 'axios';
import {
	ChatCommands,
	mediaObject
} from './types.js';
import {
	randomReply,
	randomReplyPercent,
	wordsToReply,
	isTelegramPremium,
} from './config.js';

export async function retry<T>(
	fn: (...args: any[]) => Promise<T>,
	maxAttempts: number,
): Promise<T> {
	let attempt = 1;
	while (attempt <= maxAttempts) {
		try {
			const result: T = await fn();
			return result;
		} catch (error: any) {
			console.log(`Attempt ${attempt} failed: ${error.message}`);
			attempt += 1;
		}
	}
	throw new Error(`Max attempts (${maxAttempts}) exceeded.`);
}
export function sleep(ms: number): Promise<void> {
	// eslint-disable-next-line no-promise-executor-return
	return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function downloadFile(url: string): Promise<Buffer> {
	const response = await axios.get(url, { responseType: 'arraybuffer' });
	return Buffer.from(response.data, 'binary');
}
export async function convertToImage(buffer: Buffer): Promise<string> {
	if (!(buffer instanceof Buffer)) {
		throw new Error('Not a buffer');
	}
	const folderPath = './images';
	const filepath = `${folderPath}/image.jpg`;

	const file = Bun.file(filepath);
	if (!file.size) Bun.write(filepath, '')
	await Bun.write(file, buffer);
	return filepath;
}
export async function filterMessages(messages: string[]): Promise<string[]> {
	return messages.filter((message) => !message.includes('/recap') && message.length < 300 && message.length);
}
export async function approximateTokenLength(messages: string[]): Promise<number> {
	const totalLength = messages.map((str) => str.length).reduce((accumulator, currentValue) => accumulator + currentValue, 0);
	return totalLength;
}
export async function splitMessageInChunks(message: string): Promise<string[]> {
	const maxChunkSize = 3000;
	const messageLength = message.length;
	const chunkCount = Math.ceil(messageLength / maxChunkSize);
	const chunks: string[] = [];

	for (let i = 0; i < chunkCount; i++) {
		const start = i * maxChunkSize;
		const end = start + maxChunkSize;
		const chunk: string = message.substring(start, end);

		chunks.push(chunk);
	}
	return chunks;
}
export function checkMatch(message: string, matchArray: string[]): boolean {
	for (let i = 0; i < matchArray.length; i++) {
		if (message.includes(matchArray[i])) {
			return true;
		}
	}
	return false;
}
export function checkValidUrl(link: string): boolean {
	return (link.includes('https://')) ? true : false
}
export function getCommand(messageText: string, commands: ChatCommands): string {
	const parts: string[] = messageText.split(' ');
	if (parts.length > 0 && parts[0] in commands) {
		return parts[0];
	}
	return '';
}
export const messageNotSeen = (message: any): boolean => !message.reactions && !message.editDate;
export const shouldSendRandomReply = (message: any): boolean => randomReply && checkMatch(message.message, wordsToReply) && Math.random() < randomReplyPercent && messageNotSeen(message);
export const shouldTranscribeMedia = (message: any): boolean => isTelegramPremium && message.mediaUnread && canTranscribeMedia(message.media);
export const somebodyMentioned = (message: any): boolean => message.originalArgs.mentioned;
export const canTranscribeMedia = (media: mediaObject): boolean => (media?.document?.mimeType === 'audio/ogg' || media?.document?.mimeType === 'video/mp4');
