import { Configuration, OpenAIApi } from 'openai';
import { ProcessEnv, CommandHandlers } from './types';
import {
	handleImagineCommand,
	handleImgCommand,
	handleClearCommand,
	handleRecapCommand,
	handleQCommand
} from './mainFunctions';
// system
export const config = {
	API_ID: Bun.env.API_ID,
	API_HASH: Bun.env.API_HASH,
	SESSION: Bun.env.SESSION,
	OPENAI_API_KEY: Bun.env.OPENAI_API_KEY,
	ORGANIZATION_ID: Bun.env.ORGANIZATION_ID,
	BOT_ID: Bun.env.BOT_ID,
	BOT_USERNAME: Bun.env.BOT_USERNAME,
	LANGUAGE: Bun.env.LANGUAGE
} as ProcessEnv;
export const configuration = new Configuration({
	organization: config.ORGANIZATION_ID,
	apiKey: config.OPENAI_API_KEY,
});
export const openai = new OpenAIApi(configuration);

// app
export const botUsername = config.BOT_USERNAME;
export const language = config.LANGUAGE;
export const isTelegramPremium = false;
export const maxHistoryLength = 15;
export const maxTokenLength = 4096;
export const messageLimit = 700;
export const randomReply = false;
export const randomReplyPercent = 0.3;
export const wordsToReply = [];
export const chatCommands = {
	'/recap': true,
	'/q': true,
	'/clear': true,
	'/img': true,
	'/imagine': true
};
export const commandHandlers: CommandHandlers = {
	'/recap': handleRecapCommand,
	'/q': handleQCommand,
	'/clear': handleClearCommand,
	'/img': handleImgCommand,
	'/imagine': handleImagineCommand,
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
