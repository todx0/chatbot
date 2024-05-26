import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { ProcessEnv } from './types';

export const config = {
	API_ID: Bun.env.API_ID,
	BOT_ID: Bun.env.BOT_ID,
	DB_NAME: Bun.env.DB_NAME,
	SESSION: Bun.env.SESSION,
	API_HASH: Bun.env.API_HASH,
	LANGUAGE: Bun.env.LANGUAGE,
	BOT_USERNAME: Bun.env.BOT_USERNAME,
	GAPI: Bun.env.GAPI,
} as ProcessEnv;

export const maxHistoryLength = 20;
export const isTelegramPremium = false;
export const botUsername = config.BOT_USERNAME;
export const messageLimit = 700;
export const maxTokenLength = 4096;

const genAImodelName = 'gemini-1.5-flash-latest';
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
	// generationConfig: { maxOutputTokens: 256 },
};
export const genAI = new GoogleGenerativeAI(config.GAPI);
export const genAImodel = genAI.getGenerativeModel(generativeModelOptions);
export const recapTextRequest = `Mandatory options: Do not use markup; Use only ${Bun.env.LANGUAGE}; ${Bun.env.SECRET_OPTIONS} \n Generate a short recap of the following conversation: \n`;

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
	];
	checkRequiredEnvVariables(requiredEnvVariables);
}
