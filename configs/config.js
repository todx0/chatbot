/* eslint-disable global-require */
const { Configuration, OpenAIApi } = require('openai');

if (process.env.NODE_ENV !== 'heroku') {
	require('dotenv').config({
		path: `.env.${process.env.NODE_ENV}`,
	});
} else {
	require('dotenv').config();
}

const {
	API_ID,
	API_HASH,
	SESSION,
	GROUP_ID,
	OPENAI_API_KEY,
	ORGANIZATION_ID,
	LANGUAGE
} = process.env;

const generateSummaryText = `Generate detailed summary in ${LANGUAGE} language. Ignore /recap requests: `;

const configuration = new Configuration({
	organization: ORGANIZATION_ID,
	apiKey: OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

module.exports = {
	API_ID,
	API_HASH,
	SESSION,
	GROUP_ID,
	OPENAI_API_KEY,
	ORGANIZATION_ID,
	generateSummaryText,
	openai
};
