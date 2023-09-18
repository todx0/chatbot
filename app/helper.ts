import axios from 'axios';
import { Api } from 'telegram';
import { unlink } from 'node:fs/promises';
import { Database } from 'bun:sqlite';
import * as fs from 'node:fs';
import {
	roleContent,
	mediaObject,
	ChatCommands,
	DatabaseOptions
} from './types';
import {
	randomReply,
	replyThreshold,
	maxHistoryLength,
	isTelegramPremium,
	randomReplyPercent,
} from './config';

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
			console.error(`Attempt ${attempt} failed: ${error}`);
			attempt += 1;
			Bun.sleep(1000);
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
	const filepath = './images/image.jpg';
	const file = Bun.file(filepath);

	if (!file.size) Bun.write(filepath, '');
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

export async function splitMessageInChunks(message: string, maxChunkSize: number = 3000): Promise<string[]> {
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

export async function insertToMessages(object: roleContent, dbsqlite?: string): Promise<void> {
	const dbName = dbsqlite || Bun.env.DB_NAME;
	const db = new Database(dbName);
	const { role, content } = object;
	db.run('INSERT INTO messages (role, content) VALUES (?, ?)', [role, content]);
}

export async function readRoleContentFromDatabase(options: DatabaseOptions = {}): Promise<any[]> {
	const { limit = maxHistoryLength, dbsqlite } = options;
	const dbName = dbsqlite || Bun.env.DB_NAME;
	const db = new Database(dbName);
	const query = `SELECT role, content FROM messages ORDER BY id ASC LIMIT ${limit}`;
	const rows = db.query(query).all();
	return rows; // reverse?
}

export async function clearMessagesTable(dbsqlite?: string): Promise<void> {
	const dbName = dbsqlite || Bun.env.DB_NAME;
	const db = new Database(dbName);
	db.run('DELETE FROM messages');
}

export async function trimMessagesTable(options: DatabaseOptions = {}): Promise<void> {
	const { limit = maxHistoryLength, dbsqlite } = options;
	const dbName = dbsqlite || Bun.env.DB_NAME;
	const db = new Database(dbName);
	const queryRemove = `DELETE FROM messages ORDER BY ID ASC LIMIT ${limit};`;
	db.run(queryRemove);
}

export async function createMessagesTable(dbsqlite?: string): Promise<void> {
	const dbName = dbsqlite || Bun.env.DB_NAME;
	const db = new Database(dbName);
	db.run(`
		CREATE TABLE IF NOT EXISTS messages (
		  id INTEGER PRIMARY KEY AUTOINCREMENT,
		  role TEXT,
		  content TEXT
		)
	  `);
}

export async function deleteDatabase(dbsqlite?: string): Promise<void> {
	try {
		const dbName = dbsqlite || Bun.env.DB_NAME;
		if (dbName) await unlink(dbName);
		console.log(`Deleted the database file '${dbName}'`);
	} catch (error) {
		console.log('Error deleting the database file:', error);
	}
}

export async function processCommands(messageText: string, handlers: object): Promise<void> {
	for (const [command, handler] of Object.entries(handlers)) {
		if (messageText.includes(command)) {
			return handler(messageText);
		}
	}
	return Promise.resolve();
}

export async function checkDatabaseExist(): Promise<boolean> {
	const dbName = Bun.env.DB_NAME!;
	try {
		await fs.promises.access(dbName, fs.constants.F_OK);
		return true;
	} catch (err) {
		return false;
	}
}

export const messageNotSeen = (message: Api.Message): boolean => !message.reactions && !message.editDate;
export const shouldRandomReply = (message: Api.Message): boolean => randomReply && Math.random() * 100 < randomReplyPercent && messageNotSeen(message) && message.message.length > replyThreshold;
export const shouldTranscribeMedia = (message: any): boolean => isTelegramPremium && message.mediaUnread && canTranscribeMedia(message.media);
export const somebodyMentioned = (message: Api.Message): boolean => message.originalArgs.mentioned;
export const canTranscribeMedia = (media: mediaObject): boolean => (media?.document?.mimeType === 'audio/ogg' || media?.document?.mimeType === 'video/mp4');
