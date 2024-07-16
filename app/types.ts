import { Api } from 'telegram';
import { MessageIDLike } from 'telegram/define';

export interface MessageData {
  groupId: string;
  messageId: number;
  userEntity: string;
  messageText: string;
  user: Api.User;
  replyToMsgId?: any;
  message?: any;
  image?: boolean;
  filepath?: string;
  mediaContent?: string;
  replyMessageText?: string;
  replyMessageContent?: string;
  dataFromGetMessages?: any;
}

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
export interface QueryDataToGetUserMessages {
  groupId: string;
  firstName: string;
  userEntity: string;
  limit?: number;
  offsetDate?: number;
}

export interface CommandHandler {
  (messageText?: string): Promise<void>;
}

export interface CommandMappings {
  [command: string]: CommandHandler;
}
