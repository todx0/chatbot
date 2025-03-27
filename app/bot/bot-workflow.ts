import { telegramBot } from '@app/config';
import { isRandomReply, shouldTranscribeMedia, somebodyMentioned } from '@app/utils/helper';
import type { Api } from 'telegram';

export async function botWorkflow(event: Api.TypeUpdate): Promise<void> {
	const msgData = await telegramBot.messageProcessor.prepareMsgData(event);
	if (!msgData) return;

	if (await telegramBot.commandHandler.executeCommand(msgData)) return;

	if (somebodyMentioned(msgData)) {
		await telegramBot.processMention(msgData);
		return;
	}

	if (isRandomReply(msgData)) {
		await telegramBot.processRandomReply(msgData);
		return;
	}

	/* 	if (shouldTranscribeMedia(msgData)) {
		await telegramBot.transcribeMedia(msgData);
		return;
	} */
}
