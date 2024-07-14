import { Content } from '@google/generative-ai';
import axios from 'axios';
import { Database } from 'bun:sqlite';
import * as fs from 'node:fs';
import { unlink } from 'node:fs/promises';
import { Api } from 'telegram';
import { featureFlags, getSpecialTreatmentUsers, MAX_HISTORY_LENGTH, TELEGRAM_PREMIUM } from '../config';
import { ErrorHandler } from '../errors/ErrorHandler';
import { DatabaseOptions, MediaObject, MessageData } from '../types';

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

export async function convertToImage(buffer: Buffer, filepath = './images/image.jpeg'): Promise<string> {
  if (!(buffer instanceof Buffer)) {
    throw new Error('Not a buffer');
  }
  const file = Bun.file(filepath);
  if (!file.size) Bun.write(filepath, '');
  await Bun.write(file, buffer);
  return filepath;
}

export async function readAndParseJson(filePath: string): Promise<any> {
  const file = Bun.file(filePath, { type: 'application/json' });
  const contents = await file.json();
  return contents;
}

export async function filterMessages(messages: string[]): Promise<string[]> {
  return messages.filter((message) => !message.includes('/recap') && message.length < 300 && message.length);
}

export async function approximateTokenLength(messages: string[]): Promise<number> {
  const totalLength = messages
    .map((str) => str.length)
    .reduce((accumulator, currentValue) => accumulator + currentValue, 0);
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

export async function insertToMessages(object: Content, dbsqlite?: string): Promise<void> {
  const dbName = dbsqlite || Bun.env.DB_NAME;
  const db = new Database(dbName, { create: true, readwrite: true });
  const { role, parts } = object;
  db.run('INSERT INTO messages (role, parts) VALUES (?, ?)', [role, JSON.stringify(parts)]);
}

export async function readChatRoleFromDatabase(options: DatabaseOptions = {}): Promise<Content[]> {
  const { limit = MAX_HISTORY_LENGTH, dbsqlite } = options;
  const dbName = dbsqlite || Bun.env.DB_NAME;
  const db = new Database(dbName, { create: true, readwrite: true });
  const query = `SELECT role, parts FROM messages ORDER BY id ASC LIMIT ${limit}`;

  interface Row {
    role: string;
    parts: string; // JSON string
  }
  const rows = db.query(query).all() as Row[];

  const parseRow = (row: Row): Content => {
    try {
      return {
        role: row.role,
        parts: JSON.parse(row.parts),
      };
    } catch (error) {
      console.error('Failed to parse parts for row:', row, error);
      return {
        role: row.role,
        parts: [],
      };
    }
  };
  const parsedRows: Content[] = rows.map(parseRow);
  return parsedRows;
}

export async function clearMessagesTable(dbsqlite?: string): Promise<void | string> {
  const dbName = dbsqlite || Bun.env.DB_NAME;
  try {
    const db = new Database(dbName, { create: true, readwrite: true });
    db.run('DELETE FROM messages');
  } catch (error: any) {
    console.error('Error deleting messages:', error);
    return ErrorHandler.handleError(error, true);
  }
}

export async function trimMessagesTable(options: DatabaseOptions = {}): Promise<void> {
  const { limit = MAX_HISTORY_LENGTH, dbsqlite } = options;
  const dbName = dbsqlite || Bun.env.DB_NAME;
  const db = new Database(dbName, { create: true, readwrite: true });
  const queryRemove = `
		DELETE FROM messages
		WHERE id IN (SELECT id FROM messages ORDER BY id ASC LIMIT ${limit});
  	`;
  db.run(queryRemove);
}

export async function createMessagesTable(dbsqlite?: string): Promise<void> {
  const dbName = dbsqlite || Bun.env.DB_NAME;
  const db = new Database(dbName, { create: true, readwrite: true });
  db.run(`
		CREATE TABLE IF NOT EXISTS messages (
		  id INTEGER PRIMARY KEY AUTOINCREMENT,
		  role TEXT,
		  parts TEXT
		)
	`);
}

export async function deleteDatabase(dbsqlite?: string): Promise<void | string> {
  try {
    const dbName = dbsqlite || Bun.env.DB_NAME;
    if (dbName) await unlink(dbName);
    console.log(`Deleted the database file '${dbName}'`);
  } catch (error: any) {
    console.error('Error deleting the database file:', error);
    return ErrorHandler.handleError(error, false);
  }
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

export async function checkAndUpdateDatabase({ readLimit = 1000, trimLimit = MAX_HISTORY_LENGTH } = {}): Promise<void> {
  const db = await readChatRoleFromDatabase({ limit: readLimit });
  if (db.length > trimLimit) {
    await trimMessagesTable({ limit: trimLimit });
  }
}

/** @todo add guard to prevent type errors. Consider refactoring if adding to much fields.*/
export function getDataFromEvent(event: Api.TypeUpdate): MessageData {
  const responseObject: any = {};

  if (
    event instanceof Api.UpdateNewMessage ||
    event instanceof Api.UpdateNewChannelMessage
  ) {
    const message = (event as any).message;
    responseObject.groupId = message?._chatPeer?.channelId || message?._chatPeer?.chatId;
    responseObject.replyToMsgId = message?.replyTo?.replyToMsgId;
    responseObject.messageText = message?.message;
    responseObject.messageId = message?.id;
    responseObject.message = message;
    responseObject.image = !!message?.media?.photo;
    responseObject.userEntity = message?.fromId;
  } else if (event instanceof Api.UpdateShortChatMessage) {
    responseObject.groupId = (event as any).chatId;
    responseObject.replyToMsgId = (event as any).replyTo?.replyToMsgId;
    responseObject.messageText = (event as any).message;
    responseObject.messageId = (event as any).id;
    responseObject.message = event;
    responseObject.image = !!(event as any).media?.photo;
    responseObject.userEntity = (event as any).fromId;
  }
  return responseObject;
}

export function replaceDoubleSpaces(str: string): string {
  const regex = /\s{2,}/g;
  return str.replace(regex, ' ');
}

export const messageNotSeen = (message: Api.Message): boolean => !message.reactions && !message.editDate;
export const canTranscribeMedia = (
  media: MediaObject,
): boolean => (media?.document?.mimeType === 'audio/ogg' || media?.document?.mimeType === 'video/mp4');
export const shouldTranscribeMedia = (message: any): boolean =>
  TELEGRAM_PREMIUM && message.mediaUnread && canTranscribeMedia(message.media);
export const somebodyMentioned = (message: Api.Message): boolean => (message.mentioned ? message.mentioned : false);
export const eligibleForSpecialTreatment = (
  username: string,
): boolean => (featureFlags.randomReply && (getSpecialTreatmentUsers()).includes(username));
