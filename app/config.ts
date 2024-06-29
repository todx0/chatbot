import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory, ModelParams } from '@google/generative-ai';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index';
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
  SECRET_OPTIONS: Bun.env.SECRET_OPTIONS,
} as ProcessEnv;

export const featureFlags = {
  humanize: true,
};

export const client = new TelegramClient(
  new StringSession(config.SESSION),
  +config.API_ID,
  config.API_HASH,
  {
    connectionRetries: 5,
  },
);

export const maxHistoryLength = 20;
export const isTelegramPremium = false;
export const botUsername = config.BOT_USERNAME;
export const messageLimit = 700;
export const maxTokenLength = 4096;
export const pollTimeoutMs = 5 * 60 * 1000;

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
const generativeModelOptions: ModelParams = {
  model: genAImodelName,
  systemInstruction: `Use telegram markdown. Always reply in ${config.LANGUAGE}. ${config.SECRET_OPTIONS}. 
  ${
    featureFlags.humanize
      ? 'Adjust the tone of the reply to be a little bit more noxious, blunt, and impolite.'
      : ''
  }`,
};
const generativeModelOptionsForRecap: ModelParams = {
  model: genAImodelName,
  systemInstruction: `Use telegram markdown. Always reply in ${config.LANGUAGE}. ${config.SECRET_OPTIONS}.`,
};
export const genAI = new GoogleGenerativeAI(config.GAPI);
export const genAImodel = genAI.getGenerativeModel(generativeModelOptions);
export const genAImodelForRecap = genAI.getGenerativeModel(generativeModelOptionsForRecap);
export const recapTextRequest =
  `Generate a short recap of the following conversation: \n. Total message length should exceed ${maxTokenLength} symbols.`;

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
    'GAPI',
    'SECRET_OPTIONS',
  ];
  checkRequiredEnvVariables(requiredEnvVariables);
}

export function initConfig(): void {
  try {
    loadConfig();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
