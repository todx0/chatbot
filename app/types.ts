import { MessageIDLike } from 'telegram/define';

export interface ProcessEnv {
  [key: string]: string;
}
export interface SendMessageParams {
  peer: string;
  message: string;
  replyToMsgId?: MessageIDLike;
  silent?: boolean;
  chatId?: any;
}
export interface MediaObject {
  document: {
    mimeType: string;
  };
}
export interface ChatCommands {
  [key: string]: boolean;
}
export interface DatabaseOptions {
  limit?: number;
  dbsqlite?: string;
}
export interface MessageData {
  groupId: string;
  replyToMsgId: number;
  messageId: number;
  messageText: string;
  message?: any;
  photo?: any;
}
export interface MessageObject {
  replyMessageContent: string;
  photo?: string;
  filePath?: string;
}
