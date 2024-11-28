import { Api } from 'telegram';
import { MessageIDLike } from 'telegram/define';

declare global {
  interface MessageData {
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

  interface ProcessEnv {
    [key: string]: string;
  }

  interface SendMessageParams {
    peer: string;
    message: string;
    replyToMsgId?: MessageIDLike;
    silent?: boolean;
    chatId?: any;
  }

  interface MediaObject {
    document: {
      mimeType: string;
    };
  }

  interface ChatCommands {
    [key: string]: boolean;
  }

  interface DatabaseOptions {
    limit?: number;
    dbsqlite?: string;
  }

  interface PollMessage {
    updates: { id: number }[];
  }

  interface PollResults {
    updates: {
      results?: {
        results: { voters: number }[];
      };
    }[];
  }

  interface QueryDataToGetUserMessages {
    groupId: string;
    firstName: string;
    userEntity: string;
    limit?: number;
    offsetDate?: number;
  }

  interface CommandHandler {
    (messageText?: string): Promise<void>;
  }

  interface CommandMappings {
    [command: string]: CommandHandler;
  }
}

export {};
