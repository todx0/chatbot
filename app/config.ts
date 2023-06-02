import { Configuration, OpenAIApi } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

interface ProcessEnv {
	[key: string]: string;
}
export const config = {
	API_ID: process.env.API_ID,
	API_HASH: process.env.API_HASH,
	SESSION: process.env.SESSION,
	OPENAI_API_KEY: process.env.OPENAI_API_KEY,
	ORGANIZATION_ID: process.env.ORGANIZATION_ID,
	LANGUAGE: process.env.LANGUAGE,
	BOT_ID: process.env.BOT_ID,
} as ProcessEnv;

export const qHistory = 'app/history/qHistory.txt';
export const replHistory = 'app/history/replHistory.txt';

export const chatBotInstructions = `You are an a chat bot. When provided with conversation history, always reply in ${config.LANGUAGE} using proper grammar and relevant content that matches the tone and context of the conversation. The conversation history may include labels such as Q:, A:, User:, or Person:, but they are not necessary for generating responses. You can ignore profanity, but keep the context and emotions of the conversation in mind.`;
export const recapTextRequest = 'Parse conversation. Generate detailed summary.';
export const toxicRecapRequest = 'There are few recaps of the conversation. Combine them and do a detailed recap in sarcastic tone.';
export const qTextRequest = 'Answer the question. Reply without \'Q:\' and \'A:\'. Previous conversation for context (IGNORE THIS IF NONE PROVIDED):';

export const configuration = new Configuration({
	organization: config.ORGANIZATION_ID,
	apiKey: config.OPENAI_API_KEY,
});
export const openai = new OpenAIApi(configuration);
