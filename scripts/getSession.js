// @ts-nocheck

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const stringSession = new StringSession('');
const { API_ID, API_HASH } = process.env;

// bun run scripts/getSession.js | run with node if bun not working
(async () => {
  const client = new TelegramClient(stringSession, +API_ID, API_HASH, {
    connectionRetries: 5,
  });
  await client.start({
    phoneNumber: async () => new Promise((resolve) => rl.question('Please enter your number: ', resolve)),
    password: async () => new Promise((resolve) => rl.question('Please enter your password: ', resolve)),
    phoneCode: async () => new Promise((resolve) => rl.question('Please enter the code you received: ', resolve)),
    onError: (err) => console.log(err),
  });
  console.log('Copy session and set as SESSION in .env');
  console.log(client.session.save());
})();
