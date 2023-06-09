import axios from 'axios';
import fs from 'fs';

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

	if (!fs.existsSync(folderPath)) {
		fs.mkdirSync(folderPath);
	}
	fs.writeFileSync(filepath, buffer, { flag: 'w' });

	return filepath;
}
export async function filterMessages(messages: string[]): Promise<string[]> {
	return messages.filter((message) => !message.includes('/recap') && message.length < 300 && message.length);
}
export async function approximateTokenLength(messages: string[]): Promise<number> {
	const totalLength = messages.map((str) => str.length).reduce((accumulator, currentValue) => accumulator + currentValue);
	return totalLength;
}
export async function convertFilteredMessagesToString(messages: string[]): Promise<string> {
	return messages.toString();
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
export function checkMatch(message: string, matchArray: string[]) {
	for (let i = 0; i < matchArray.length; i++) {
		if (message.includes(matchArray[i])) { return true; }
	}
	return false;
}
