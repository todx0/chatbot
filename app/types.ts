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
  messageId: number;
  userEntity: string;
  messageText: string;
  replyToMsgId?: any;
  message?: any;
  image?: boolean;
}
export interface MessageObject {
  replyMessageContent: string;
  image?: boolean;
  filepath?: string;
  mediaContent?: string;
  textContent?: string;
}
export interface PollMessage {
  updates: { id: number }[];
}
export interface PollResults {
  updates: {
    results?: {
      results: { voters: number }[];
    };
  }[];
}
