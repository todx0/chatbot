# Telegram GPT Chatbot

Telegram bot based on [gramjs](https://gram.js.org/) using 'advanced' AI technologies to annoy chat participants.

The bot requires a real Telegram account and is not managed by BotFather. See how it [works](https://gram.js.org/getting-started/authorization#logging-in-as-a-user).

## Installation

1. Install [Bun](https://bun.sh/docs/installation).
2. Clone the repository.
3. Rename `.env.example` to `.env`.
4. Generate API_ID and API_HASH [here](https://gram.js.org/getting-started/authorization#getting-api-id-and-api-hash).
5. Generate SESSION key. [Learn how](https://gram.js.org/getting-started/authorization).
6. Get your OPENAI_API_KEY [here](https://platform.openai.com/account/api-keys).
7. Get your ORGANIZATION_ID [here](https://platform.openai.com/account/org-settings).
8. Login as a bot and send a message to @RawDataBot. Use `message.from.id` as BOT_ID.
9. In .env set your BOT_USERNAME to your bot username including @.

After completing the above steps, you can proceed with the following commands:

```bash
# Install
bun install

# Start
bun start
```

## Configuration

Customize the bot's behavior by editing the `app/config.ts` file. Key configuration options include:

- `botBehavior`: Define your desired bot behavior.
- `isTelegramPremium`: Enable automatic transcription of media messages if your bot account has Telegram premium.
- `chatCommands`: Enable or disable specific commands by setting them to true or false.
- `maxHistoryLength`: Set the maximum length of chat history passed to the bot. Longer histories result in more expensive API calls.

### Random Reply

- `randomReply`: Enable the bot to send random replies to messages in the chat.
- `replyThreshold`: Set the minimum sentence length that triggers a random reply to avoid responding to very short messages.
- `randomReplyPercent`: Adjust the percentage of random replies.

## Usage

### Always Replies:
When you reply to the bot's message, it will always respond.

### Reply to Tag:
If you reply to a person's message and tag the bot, it will reply to that person.

### Mentioning the Bot:
Mentioning the bot will trigger a reply. This is similar to using the /q command, but the bot also understands the recent context.

### Commands
- `/q` - Allows the user to ask the bot a question. Example: `/q how to avoid taxes?`
- `/recap` - Generates a summary of the recent conversation based on the provided message limit value. Example: `/recap 200`
- `/img` - Generates an image based on the query. Example: `/img prison cell`
- `/imagine` - Generates an image based on the summary message from `/recap`. Example: `/imagine 200`
- `/clear` - Clears the chat bot's history file. This command is useful for debugging purposes.

## Hosting

[fly.io](https://fly.io/) does everything out of the box and supports Bun.




