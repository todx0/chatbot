import {
	expect, test, describe, beforeEach, spyOn
} from 'bun:test';
import {
	clearMessagesTable,
	readRoleContentFromDatabase,
} from '../app/helper';
import TelegramBot from '../app/mainHelper';
import client from '../app/main';
import {
	longMockArrayOfMessages
} from './testData/testDataForMocks';

describe('main helper functions', async () => {
	const bot = new TelegramBot(client);
	beforeEach(async () => {
		//@ts-ignore
		spyOn(bot, 'getMessages').mockResolvedValue(longMockArrayOfMessages);
	});

	test('fetchAndInsertMessages adding messages to db', async () => {
		await clearMessagesTable();
		await bot.fetchAndInsertMessages(10);
		const dbResponse = await readRoleContentFromDatabase({ limit: 100 });
		const len = longMockArrayOfMessages.length;
		expect(dbResponse).toBeArrayOfSize(len);
	});
});