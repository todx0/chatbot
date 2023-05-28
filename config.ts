import { Configuration, OpenAIApi } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const {
	API_ID,
	API_HASH,
	SESSION,
	OPENAI_API_KEY,
	ORGANIZATION_ID,
	LANGUAGE,
	BOT_ID,
} = process.env;

const recapTextRequest = `Parse conversation. Generate detailed summary in ${LANGUAGE} language. Ignore profanity but keep context: `;
const toxicRecapRequest = `There are few recaps of the conversation. Combine them and do a detailed recap in ${LANGUAGE} language in a little of sarcastic way and sound that you are annoyed:`;

const configuration = new Configuration({
	organization: ORGANIZATION_ID,
	apiKey: OPENAI_API_KEY!,
});

const openai = new OpenAIApi(configuration);

export {
	BOT_ID,
	API_ID,
	API_HASH,
	SESSION,
	OPENAI_API_KEY,
	ORGANIZATION_ID,
	recapTextRequest,
	openai,
	LANGUAGE,
	toxicRecapRequest,
};
