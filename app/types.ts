import { MessageIDLike } from 'telegram/define';

interface ChatPart {
	text: string;
}

export interface ChatRole {
	role: 'user' | 'model';
	parts: ChatPart[];
}

export interface ProcessEnv {
	[key: string]: string;
}
export interface SendMessageParams {
	peer: string,
	message: string,
	replyToMsgId?: MessageIDLike,
	silent?: boolean,
	chatId?: any
}
export interface GetMessagesParams {
	limit: number;
	groupId: string;
}
export interface MediaObject {
	document: {
		mimeType: string
	}
}
export interface ChatCommands {
	[key: string]: boolean;
}
export interface RetryFn {
	<T>(fn: () => Promise<T>, maxAttempts: number): Promise<T>;
}
export interface DatabaseOptions {
	limit?: number;
	dbsqlite?: string;
}
