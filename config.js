/* eslint-disable global-require */
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const {
	API_ID,
	API_HASH,
	SESSION,
	OPENAI_API_KEY,
	ORGANIZATION_ID,
	LANGUAGE
} = process.env;

const openAiTextRequest = `Parse conversation. Generate detailed summary in ${LANGUAGE} language. Ignore profanity but keep context: `;

const configuration = new Configuration({
	organization: ORGANIZATION_ID,
	apiKey: OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

module.exports = {
	API_ID,
	API_HASH,
	SESSION,
	OPENAI_API_KEY,
	ORGANIZATION_ID,
	openAiTextRequest,
	openai,
};
