const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const {
	API_ID,
	API_HASH,
	SESSION,
	GROUP_ID,
	FWD_CHANNEL_ID,
	REACTION_LIMIT,
	CHATGPT_SECRET
} = require('../configs/config');

const client = new TelegramClient(new StringSession(SESSION), +API_ID, API_HASH, {
	connectionRetries: 5,
});
async function sendMessages(updateMsgId, groupId, fwdChannelId) {
	const fwd = await client.invoke(
		new Api.messages.ForwardMessages({
			fromPeer: groupId,
			id: [updateMsgId],
			toPeer: fwdChannelId,
		})
	);
	const send = await client.invoke(
		new Api.messages.SendMessage({
			peer: fwdChannelId,
			message: `https://t.me/c/${groupId}/${updateMsgId}`,
		})
	);
	return [fwd, send];
}

async function messageExistsInChannel(messageDate, fwdChannelId) {
	for await (const message of client.iterMessages(fwdChannelId)) {
		if (messageDate === message?.fwdFrom?.date) {
			return true;
		}
	}
	return false;
}

async function countReactions(message) {
	let rCount = 0;
	for (const reaction of message) {
		rCount += reaction.count;
	}
	return rCount;
}

async function getRealMessageDate(message) {
	if (message?.fwdFrom?.date) {
		return message.fwdFrom.date;
	} if (message.date) {
		return message.date;
	}
}
async function main() {
	for await (const message of client.iterMessages(`-100${GROUP_ID}`, { limit: 500 })) {
		if (message?.reactions?.results) {
			const reactionsResult = message.reactions.results;
			const messageReactionsNumber = await countReactions(reactionsResult);
			if (messageReactionsNumber >= REACTION_LIMIT) {
				const realDate = await getRealMessageDate(message);
				const isMessageExists = await messageExistsInChannel(realDate, FWD_CHANNEL_ID);
				if (!isMessageExists) {
					if (message.id) {
						await sendMessages(message.id, GROUP_ID, FWD_CHANNEL_ID);
					}
				}
			}
		}
	}
	return null;
}

module.exports = {
	main, client
};
