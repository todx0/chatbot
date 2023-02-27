const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const {
    API_ID,
    API_HASH,
    BOT_TOKEN,
    SESSION,
    GROUP_ID,
    FWD_CHANNEL_ID,
    REACTION_LIMIT,
    CHATGPT_SECRET
} = require('./configs/config');

const stringSession = ''; // leave this empty for now
    (async () => {
        const client = new TelegramClient(new StringSession(stringSession),
            API_ID, API_HASH, { connectionRetries: 5 });
        await client.start({
            botAuthToken: BOT_TOKEN
        });
        console.log(client.session.save())
    })();
