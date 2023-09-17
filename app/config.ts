import { Configuration, OpenAIApi } from 'openai';
import { ProcessEnv } from './types';

// system
export const config = {
	API_ID: Bun.env.API_ID,
	BOT_ID: Bun.env.BOT_ID,
	SESSION: Bun.env.SESSION,
	API_HASH: Bun.env.API_HASH,
	LANGUAGE: Bun.env.LANGUAGE,
	BOT_USERNAME: Bun.env.BOT_USERNAME,
	OPENAI_API_KEY: Bun.env.OPENAI_API_KEY,
	ORGANIZATION_ID: Bun.env.ORGANIZATION_ID,
} as ProcessEnv;
export const configuration = new Configuration({
	apiKey: config.OPENAI_API_KEY,
	organization: config.ORGANIZATION_ID,
});
export const openai = new OpenAIApi(configuration);

// app
export const messageLimit = 700;
export const maxHistoryLength = 15;
export const maxTokenLength = 4096;
export const randomReplyPercent = 0.1;
export const isTelegramPremium = false;
export const randomReply = true;
export const replyThreshold = 20;
export const language = config.LANGUAGE;
export const botUsername = config.BOT_USERNAME;

export const chatCommands = {
	'/recap': true,
	'/q': true,
	'/clear': true,
	'/img': true,
	'/imagine': true
};

export const dbname = 'db.sqlite';

// gpt
export const model = 'gpt-4-0613';
export const botBehavior = `You are a chatbot. Provide a concise reply based on the message you receive. Act like annoyed pseudopsychologist and reply in ${language} but always provide an answer.`;
export const systemContent = {
	role: 'system',
	content: botBehavior
};
export const recapTextRequest = `Parse conversation. Generate detailed summary in ${language} language. Ignore profanity but keep context: `;
export const toxicRecapRequest = `There are few recaps of the conversation. Combine them and do a detailed recap in ${language} language (answer should be less than 4096 characters):`;
