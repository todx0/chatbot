// @ts-nocheck

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');

const stringSession = new StringSession('');
const { API_ID, API_HASH } = process.env;

// doesn't work with bun. Should be ran as node scripts/getSession.js

(async () => {
	const client = new TelegramClient(stringSession, +API_ID, API_HASH);
	await client.start({
		phoneNumber: async () => await input.text('number ?'),
		password: async () => await input.text('password ?'),
		phoneCode: async () => await input.text('code ?'),
		onError: (err) => console.log(err),
	});
	console.log('Copy session and set as SESSION in .env');
	console.log(client.session.save());
})();
