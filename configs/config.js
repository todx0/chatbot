/* eslint-disable global-require */
if (process.env.NODE_ENV !== 'heroku') {
	require('dotenv').config({
		path: `.env.${process.env.NODE_ENV}`,
	});
} else {
	require('dotenv').config();
}

const {
	NODE_ENV,
	BOT_TOKEN,
	API_ID,
	API_HASH,
	SESSION,
	BOT_SESSION,
	GROUP_ID,
	FWD_CHANNEL_ID,
	REACTION_LIMIT,
	INTERVAL,
	CHATGPT_SECRET
} = process.env;

module.exports = {
	NODE_ENV,
	BOT_TOKEN,
	BOT_SESSION,
	SESSION,
	API_ID,
	API_HASH,
	GROUP_ID,
	FWD_CHANNEL_ID,
	REACTION_LIMIT,
	INTERVAL,
	CHATGPT_SECRET
};
