import { MessageIDLike } from 'telegram/define';

export interface roleContent {
	role: 'user' | 'assistant' | 'system';
	content: any;
}
export interface gptRequest {
	conversationHistory: any[],
	userRequest: string
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
	[command: string]: (id: string, msg: string) => Promise<void | string>;
}
