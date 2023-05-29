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

export const recapTextRequest = `Parse conversation. Generate detailed summary in ${config.LANGUAGE} language. Ignore profanity but keep context: `;
export const toxicRecapRequest = `There are few recaps of the conversation. Combine them and do a detailed recap in ${config.LANGUAGE} language in a little of sarcastic way and sound that you are annoyed:`;
export const qTextRequest = `Answer the question in ${config.LANGUAGE}. Analyse previous questions and answers (Ignore if none provided, ignore "Q:" and "A:"):`;

export const configuration = new Configuration({
	organization: config.ORGANIZATION_ID,
	apiKey: config.OPENAI_API_KEY,
});
export const openai = new OpenAIApi(configuration);
