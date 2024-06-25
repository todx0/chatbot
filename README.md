# AI Telegram Chatbot

Telegram bot based on [gramjs](https://gram.js.org/) and gemini-pro using 'advanced' AI technologies to annoy chat participants.

The bot requires a real Telegram account and is not managed by BotFather. See how it [works](https://gram.js.org/getting-started/authorization#logging-in-as-a-user).

## Installation

1. Install [Bun](https://bun.sh/docs/installation)
2. Clone the repository
3. Rename `.env.example` to `.env`
4. Generate API_ID and API_HASH [here](https://gram.js.org/getting-started/authorization#getting-api-id-and-api-hash).
5. Generate SESSION key [Learn how](https://gram.js.org/getting-started/authorization) or run `bun scripts/getSession.js`
6. Get your GAPI key [here](https://makersuite.google.com/app/apikey).
7. Login as a bot and send a message to @RawDataBot. Use `message.from.id` as BOT_ID.
8. In .env set your BOT_USERNAME to your bot username including @.

After completing the above steps, you can proceed with the following commands:

```bash
# Install
bun install

# Start
bun start
```

## Configuration

Customize the bot's behavior by editing the `app/config.ts` file. Key configuration options include:

- `isTelegramPremium`: Enable automatic transcription of media messages if your bot account has Telegram premium.
- `maxHistoryLength`: Set the maximum length of chat history passed to the bot. Longer histories result in more expensive API calls.
- `featureFlags`: Enable/disable feature flags.
- `pollTimeoutMs`: Poll timeout before kick. In milliseconds, so change only first value. e.g. 5 * 60 * 1000 is 5 minutes.
- `maxHistoryLength`: Conversation length for the bot to know context. Longer histories result in more expensive API calls.
- `genAImodelName`: Gemini api model to use.
- `safetySettings`: [Safety, always off.](https://www.youtube.com/watch?v=47Yxa9IeJEc). See [safety settings.](https://ai.google.dev/gemini-api/docs/safety-settings)
- `generativeModelOptions.systemInstruction`: Default bot behavior. Modify as you want.

## Usage

### Always Replies:

When you reply to the bot's message, it will always respond.

### Reply to Tag:

If you reply to a person's message and tag the bot, it will reply to that person.

### Mentioning the Bot:

Mentioning the bot will trigger a reply.

### Commands

- `/recap` - Generates a summary of the recent conversation based on the provided message limit value. Example: `/recap 200`
- `/clear` - Clears the chat bot's history file. This command is useful for debugging purposes or when bot acts silly.
- `/scan` - Requires channel admin rights. Scans for inactive chat participants and removes them.
- `/votekick` - Requires channel admin rights. Proposes a vote to kick chat participant. Kicks a user if vote passes. Example: `/votekick @user`
- `/users` - Prints csv ready info about chat participants. KGB uses same functionality to track you in public chats so be aware.

## Hosting

[fly.io](https://fly.io/) does everything out of the box and supports Bun.
