import { Configuration, OpenAIApi } from 'openai';
import dotenv from 'dotenv';
import { ProcessEnv } from './types.js';

// system
dotenv.config();
export const config = {
	API_ID: process.env.API_ID,
	API_HASH: process.env.API_HASH,
	SESSION: process.env.SESSION,
	OPENAI_API_KEY: process.env.OPENAI_API_KEY,
	ORGANIZATION_ID: process.env.ORGANIZATION_ID,
	BOT_ID: process.env.BOT_ID,
} as ProcessEnv;
export const configuration = new Configuration({
	organization: config.ORGANIZATION_ID,
	apiKey: config.OPENAI_API_KEY,
});
export const openai = new OpenAIApi(configuration);

// app
export const language = 'russian';
export const maxHistoryLength = 30;
export const maxTokenLength = 4096;
export const messageLimit = 700;
export const historyFile = 'app/history/historyFile.json';
export const randomReply = true;
export const randomReplyPercent = 0.3;
export const repliableWords = ['скам', 'крипт', 'тикток', 'инста'];

// gpt
export const model = 'gpt-3.5-turbo-16k-0613';
export const systemContent = {
	role: 'system',
	content: `You are a chatbot. Always reply in ${language}. Provide a concise reply based on the message you receive. Always reply in annoyed sarcastic manner.`
};
export const recapTextRequest = `Parse conversation. Generate detailed summary in ${language} language. Ignore profanity but keep context: `;
export const toxicRecapRequest = `There are few recaps of the conversation. Combine them and do a detailed recap in ${language} language (answer should be less than 4096 characters):`;
