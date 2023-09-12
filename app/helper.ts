import axios from 'axios';
import { Database } from 'bun:sqlite';
import {
	ChatCommands,
	mediaObject,
	roleContent
} from './types.js';
import {
	randomReply,
	randomReplyPercent,
	wordsToReply,
	isTelegramPremium,
} from './config.js';
import { dbname } from './config.js';

export async function retry<T>(
	fn: (...args: any[]) => Promise<T>,
	maxAttempts: number,
): Promise<T> {
	let attempt = 1;
	while (attempt <= maxAttempts) {
		try {
			const result: T = await fn();
			return result;
		} catch (error) {
			console.log(`Attempt ${attempt} failed: ${error.message}`);
			attempt += 1;
			Bun.sleep(1000)
		}
	}
	throw new Error(`Max attempts (${maxAttempts}) exceeded.`);
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

export async function writeToDatabase(object: roleContent, dbsqlite = dbname): Promise<void> {
	const db = new Database(dbsqlite);
	const { role, content } = object;
	try {
		db.run(`INSERT INTO messages (role, content) VALUES (?, ?)`, [role, content]);
	} catch (error) {
		return error
	}
}
export async function readFromDatabase(dbsqlite = dbname): Promise<any[]> {
	const db = new Database(dbsqlite);
	try {
		const rows = db.query('SELECT role, content FROM messages').all();
		return rows;
	} catch (error) {
		return error
	}
}
export async function clearDatabase(dbsqlite = dbname): Promise<void> {
	const db = new Database(dbsqlite);
	try {
		db.run('DELETE FROM messages')
	} catch (error) {
		return error
	}
}
export async function dbTrim(amountToRemove: number, dbsqlite = dbname): Promise<void> {
	const db = new Database(dbsqlite);
	const queryRemove = `DELETE FROM messages ORDER BY ID ASC LIMIT ${amountToRemove};`;
	db.run(queryRemove)
}
export async function dbCreateTables(): Promise<void> {
	const db = new Database('db.sqlite');
	db.run(`
	  CREATE TABLE IF NOT EXISTS messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		role TEXT,
		content TEXT
	  )
	`);
}