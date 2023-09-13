import { MessageIDLike, } from 'telegram/define';

export interface roleContent {
	role: 'user' | 'assistant' | 'system';
	content: string;
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
export interface mediaObject {
	document: {
		mimeType: string
	}
}
export interface CommandHandlers {
	[command: string]: (id: string, msg: string, client) => Promise<void | string>;
}
export interface ChatCommands {
	[key: string]: boolean;
}
export interface RetryFn {
	<T>(fn: () => Promise<T>, maxAttempts: number): Promise<T>;
}
