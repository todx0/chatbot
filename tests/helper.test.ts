import {
	expect, test, describe, jest,
} from 'bun:test';
import { RoleContent } from '../app/types';
import { maxHistoryLength } from '../app/config';
import {
	retry,
	filterMessages,
	messageNotSeen,
	insertToMessages,
	trimMessagesTable,
	somebodyMentioned,
	canTranscribeMedia,
	clearMessagesTable,
	splitMessageInChunks,
	shouldTranscribeMedia,
	checkAndUpdateDatabase,
	approximateTokenLength,
	readRoleContentFromDatabase,
} from '../app/helper';
import {
	telegramMessage,
	messageOriginalArgs,
	messageMediaDocument,
} from './testData/testDataForMocks';

describe('helper functions', async () => {
	const testsData = ['message 1', '/recap 100'];

	test('retry - success before maximum retries', async () => {
		const asyncFn = jest.fn().mockResolvedValue('success');
		const result = await retry(asyncFn, 3);
		expect(result).toBe('success');
		expect(asyncFn).toHaveBeenCalledTimes(1);
	});

	describe('sqlite db tests', async () => {
		test('create and trim records', async () => {
			const trimAmount = 10;
			const testData: RoleContent = { role: 'user', content: 'test string' };
			const promises = Array(maxHistoryLength).fill(0).map(() => insertToMessages(testData));
			await Promise.all(promises);
			const dbRequest = { limit: 100 };
			const dbQueryRes = await readRoleContentFromDatabase(dbRequest);
			await trimMessagesTable({ limit: trimAmount });
			const queryResAfterTrim = await readRoleContentFromDatabase(dbRequest);
			await clearMessagesTable();
			const dbQueryAfterClear = await readRoleContentFromDatabase(dbRequest);
			expect(dbQueryRes).toBeArrayOfSize(maxHistoryLength);
			expect(queryResAfterTrim.length).toEqual(dbQueryRes.length - trimAmount);
			expect(dbQueryAfterClear.length).toEqual(0);
		});

		test('auto database cleanup after limit', async () => {
			await clearMessagesTable();
			const testData: RoleContent = { role: 'user', content: 'test string' };
			const amountToInsert = maxHistoryLength * 2;
			const promises = Array(amountToInsert).fill(0).map(() => insertToMessages(testData));
			await Promise.all(promises);
			const dbQueryResBeforeUpdate = await readRoleContentFromDatabase({ limit: 1000 });
			await checkAndUpdateDatabase();
			const dbQueryResAfterUpdate = await readRoleContentFromDatabase({ limit: 1000 });
			expect(dbQueryResBeforeUpdate.length).toEqual(maxHistoryLength * 2);
			expect(dbQueryResAfterUpdate.length).toEqual(maxHistoryLength);
		});
	});

	test('filter /recap messages', async () => {
		const res = await filterMessages(testsData);
		expect(res).toBeArrayOfSize(1);
	});

	test('calculate apr token length', async () => {
		const res = await approximateTokenLength(testsData);
		expect(res).toBeGreaterThanOrEqual(19);
	});

	test('split message in chunks', async () => {
		const messageToSplit = 'Long test message to split in chunks';
		const res = await splitMessageInChunks(messageToSplit, 2);
		expect(res).toBeArrayOfSize(18);
	});

	test('telegram message object functions', async () => {
		telegramMessage.media = messageMediaDocument;
		telegramMessage.originalArgs = messageOriginalArgs;
		const messageNotSeenRes = messageNotSeen(telegramMessage);
		const somebodyMentionedRes = somebodyMentioned(telegramMessage);
		const canTranscribeMediaRes = canTranscribeMedia(telegramMessage.media);
		const shouldTranscribeMediaRes = shouldTranscribeMedia(telegramMessage);
		expect(messageNotSeenRes).toBeTrue;
		expect(somebodyMentionedRes).toBeTrue;
		expect(canTranscribeMediaRes).toBeTrue;
		expect(shouldTranscribeMediaRes).toBeTrue;
	});

	test('split message in chunks', async () => {
		const messageToSplit = 'Long test message to split in chunks';
		const res = await splitMessageInChunks(messageToSplit, 2);
		expect(res).toBeArrayOfSize(18);
	});
});
