import { MessageIDLike } from 'telegram/define';

export interface RoleContent {
	role: 'user' | 'assistant' | 'system';
	content: string;
}
export interface RoleParts {
	role: 'user' | 'model';
	parts: string;
}
export interface ProcessEnv {
	[key: string]: string;
}
export interface SendMessageParams {
	peer: string,
	message: string,
	replyToMsgId?: MessageIDLike,
	silent?: boolean,
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
