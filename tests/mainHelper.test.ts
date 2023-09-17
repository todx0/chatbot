import {
	expect, test, describe, afterEach, beforeEach, spyOn
} from 'bun:test';
import {
	deleteDatabase,
	createMessagesTable,
	readRoleContentFromDatabase,
} from '../app/helper';
import TelegramBot from '../app/mainHelper';
import client from '../app/main';
import {
	longMockArrayOfMessages
} from './testData/testDataForMocks';

describe('main helper functions', async () => {
	const testingdb = 'testing.sqlite';
	const bot = new TelegramBot(client);
	beforeEach(async () => {
		try { await deleteDatabase(testingdb); } catch (e) { console.log(); }
		await createMessagesTable(testingdb);
		//@ts-ignore
		spyOn(bot, 'getMessages').mockResolvedValue(longMockArrayOfMessages);
	});

	afterEach(async () => {
	  await deleteDatabase(testingdb);
	});

	test('fetchAndInsertMessages adding messages to db', async () => {
		await bot.fetchAndInsertMessages(10, testingdb);
		const dbRequest = { limit: 100, dbsqlite: testingdb };
		const dbResponse = await readRoleContentFromDatabase(dbRequest);
		const len = longMockArrayOfMessages.length;
		expect(dbResponse).toBeArrayOfSize(len);
	});
});
