import {
	expect, test, describe, jest, afterEach, beforeEach
} from 'bun:test';
import fs from 'fs';
import { roleContent } from '../app/types';
import { maxHistoryLength } from '../app/config';
import {
	retry,
	// convertToImage,
	// downloadFile,
	filterMessages,
	approximateTokenLength,
	splitMessageInChunks,
	getCommand,
	messageNotSeen,
	shouldSendRandomReply,
	somebodyMentioned,
	shouldTranscribeMedia,
	// db
	clearMessagesTable,
	insertToMessages,
	deleteDatabase,
	createMessagesTable,
	trimMessagesTable,
	readRoleContentFromDatabase
} from '../app/helper';

describe('helper functions test suite', async () => {
	test('retry - success before maximum retries', async () => {
		const asyncFn = jest.fn().mockResolvedValue('success');
		const result = await retry(asyncFn, 3);
		expect(result).toBe('success');
		expect(asyncFn).toHaveBeenCalledTimes(1);
	});

	describe('sqlite db tests', async () => {
		const testingdb = 'testing.sqlite';

		beforeEach(async () => {
			await createMessagesTable(testingdb);
		});
		afterEach(async () => {
			await deleteDatabase(testingdb);
		});
		test('create and trim records', async () => {
			const trimAmount = 10;
			const testData: roleContent = { role: 'user', content: 'test string' };
			const promises = Array(maxHistoryLength).fill(0).map(() => insertToMessages(testData, testingdb));
			await Promise.all(promises);
			const dbQueryRes = await readRoleContentFromDatabase(testingdb);
			await trimMessagesTable(trimAmount, testingdb);
			const queryResAfterTrim = await readRoleContentFromDatabase(testingdb);
			expect(dbQueryRes).toBeArrayOfSize(maxHistoryLength);
			expect(queryResAfterTrim.length).toEqual(dbQueryRes.length - trimAmount);
		});
	});
});
