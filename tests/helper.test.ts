import { expect, test, describe, jest } from "bun:test";
import {
	retry,
	convertToImage,
	downloadFile,
	filterMessages,
	approximateTokenLength,
	splitMessageInChunks,
	getCommand,
	messageNotSeen,
	shouldSendRandomReply,
	somebodyMentioned,
	shouldTranscribeMedia,
	dbCreateTables,
	readFromDatabase,
	writeToDatabase,
	clearDatabase,
	dbTrim,
} from '../app/helper.js';

describe("helper functions test suite", async () => {

	test("retry - success before maximum retries", async () => {
		const asyncFn = jest.fn().mockResolvedValue('success');
		const result = await retry(asyncFn, 3);

		expect(result).toBe('success');
		expect(asyncFn).toHaveBeenCalledTimes(1);
	});

	test.todo("convertToImage - ", async () => {

	});

});