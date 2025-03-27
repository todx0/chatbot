import { botWorkflow } from '@app/bot/bot-workflow';
import { initConfig, telegramClient } from '@app/config';
import { createMessagesTable } from '@app/utils/helper';

(async () => {
	initConfig();
	await createMessagesTable();
	await telegramClient.connect();
	telegramClient.addEventHandler(botWorkflow);
})();
