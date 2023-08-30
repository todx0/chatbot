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
	BOT_USERNAME: process.env.BOT_USERNAME
} as ProcessEnv;
export const configuration = new Configuration({
	organization: config.ORGANIZATION_ID,
	apiKey: config.OPENAI_API_KEY,
});
export const openai = new OpenAIApi(configuration);

// app
export const botUsername = config.BOT_USERNAME;
export const language = 'russian';
export const isTelegramPremium = false;
export const maxHistoryLength = 30;
export const maxTokenLength = 4096;
export const messageLimit = 700;
export const historyFile = 'app/history/historyFile.json';
export const randomReply = false;
export const randomReplyPercent = 0.3;
export const repliableWords = [];
export const chatCommands = {
	'/recap': true,
	'/q': true,
	'/clear': true,
	'/img': true,
	'/imagine': true
};

// gpt
export const model = 'gpt-4-0613';
export const botBehavior = `You are a chatbot. Provide a concise reply based on the message you receive. Act like annoyed pseudopsychologist and reply in ${language} but always provide an answer.`;
export const systemContent = {
	role: 'system',
	content: botBehavior
};
export const recapTextRequest = `Parse conversation. Generate detailed summary in ${language} language. Ignore profanity but keep context: `;
export const toxicRecapRequest = `There are few recaps of the conversation. Combine them and do a detailed recap in ${language} language (answer should be less than 4096 characters):`;
