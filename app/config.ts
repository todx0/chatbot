import { Configuration, OpenAIApi } from 'openai';
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { ProcessEnv } from './types';

// system
export const config = {
	API_ID: Bun.env.API_ID,
	BOT_ID: Bun.env.BOT_ID,
	DB_NAME: Bun.env.DB_NAME,
	SESSION: Bun.env.SESSION,
	API_HASH: Bun.env.API_HASH,
	LANGUAGE: Bun.env.LANGUAGE,
	BOT_USERNAME: Bun.env.BOT_USERNAME,
	OPENAI_API_KEY: Bun.env.OPENAI_API_KEY,
	ORGANIZATION_ID: Bun.env.ORGANIZATION_ID,
	GAPI: Bun.env.GAPI,
} as ProcessEnv;

export const configuration = new Configuration({
	apiKey: config.OPENAI_API_KEY,
	organization: config.ORGANIZATION_ID,
});

// app
export const maxHistoryLength = 20;
export const isTelegramPremium = false;
export const language = config.LANGUAGE;
export const botUsername = config.BOT_USERNAME;
export const messageLimit = 700;
export const maxTokenLength = 4096;

export const chatCommands = {
	'/recap': true,
	'/q': true,
	'/clear': true,
	'/img': true,
	'/imagine': true,
};
// random reply
export const randomReply = true;
export const randomReplyPercent = 4;
export const replyThreshold = 25;

// google
const genAImodelName = 'gemini-pro';
export const safetySettings = [
	{
		category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
		threshold: HarmBlockThreshold.BLOCK_NONE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
		threshold: HarmBlockThreshold.BLOCK_NONE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_HARASSMENT,
		threshold: HarmBlockThreshold.BLOCK_NONE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
		threshold: HarmBlockThreshold.BLOCK_NONE,
	},
];
const generativeModelOptions = 	{
	model: genAImodelName,
	safetySettings,
	generationConfig: { maxOutputTokens: 256 },
};

export const genAI = new GoogleGenerativeAI(config.GAPI);
export const genAImodel = genAI.getGenerativeModel(generativeModelOptions);

// openai
export const openai = new OpenAIApi(configuration);
export const temperature = 0.8;
export const gptModel = 'gpt-4-0613';
export const botBehavior = `You are a chatbot. Provide a concise reply based on the message you receive. Act like annoyed pseudopsychologist and reply in ${language} but always provide an answer.`;
export const systemContent = {
	role: 'system',
	content: botBehavior,
};
export const recapTextRequest = `Parse conversation. Generate detailed summary in ${language} language. Ignore profanity but keep context: `;
export const toxicRecapRequest = `There are few recaps of the conversation. Combine them and do a detailed recap in ${language} language (answer should be less than 4096 characters):`;

// func
function checkRequiredEnvVariables(requiredEnvVariables: string[]): void {
	requiredEnvVariables.forEach((variable) => {
		if (!Bun.env[variable]) {
			throw new Error(`Missing environment variable: ${variable}`);
		}
	});
}
export function loadConfig(): void {
	const requiredEnvVariables = [
		'BOT_ID',
		'API_ID',
		'SESSION',
		'DB_NAME',
		'LANGUAGE',
		'API_HASH',
		'BOT_USERNAME',
		'OPENAI_API_KEY',
		'ORGANIZATION_ID',
	];
	checkRequiredEnvVariables(requiredEnvVariables);
}
