# Telegram GPT Chatbot

Telegram bot based on [gramjs](https://gram.js.org/) using 'advanced' AI technologies to annoy chat participants.

The bot requires a real Telegram account and is not managed by BotFather. See how it [works](https://gram.js.org/getting-started/authorization#logging-in-as-a-user).

## Installation

1. Install [Node.js](https://nodejs.org/en).
2. Clone the repository.
3. Rename `.env.example` to `.env`.
4. Generate API_ID and API_HASH [here](https://gram.js.org/getting-started/authorization#getting-api-id-and-api-hash).
5. Generate SESSION key. [Learn how](https://gram.js.org/getting-started/authorization).
6. Get your OPENAI_API_KEY [here](https://platform.openai.com/account/api-keys).
7. Get your ORGANIZATION_ID [here](https://platform.openai.com/account/org-settings).
8. Login as a bot and send a message to @RawDataBot. Use `message.from.id` as BOT_ID.
9. In config.ts change `botUsername` to your bot username including @
10. Set up desired bot behavior in `botBehavior`

After completing the above steps, you can proceed with the following commands:

```bash
# Install dependencies
npm install

# Compile
tsc

# Start
npm run start
```

## Usage

Please refer to `config.js` for configuration and usage instructions.

- `isTelegramPremium`: If you have premium, setting this to true will allow the bot to automatically transcribe media messages.
- `randomReply`: This setting enables the bot to randomly reply to messages from a list.
- `repliableWords`: Trigger words list for randomReply. Words should be comma-separated.
- `randomReplyPercent`: The percentage of random replies. For example, 0.3 means 30%.
- `chatCommands`: Set to true or false to enable or disable particular commands.

### Commands
- `/q` - Allows the user to ask the bot a question. Example: `/q how to avoid taxes?`
- `/recap` - Generates a summary of the recent conversation based on the provided message limit value. Example: `/recap 200`
- `/img` - Generates an image based on the query. Example: `/img prison cell`
- `/imagine` - Generates an image based on the summary message from `/recap`. Example: `/imagine 200`
- `/clear` - Clears the chat bot's history file. This command is useful for debugging purposes.

If you reply to the bot's message, the bot will always reply back.

## Heroku

The bot is ready to be run on Heroku. See `Procfile` for more details.

To run on Heroku, execute the following command:

```bash
heroku scale bot=1
```
