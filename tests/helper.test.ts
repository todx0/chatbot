import { expect, test, describe, jest, afterEach, beforeEach } from "bun:test";
import fs from 'fs';
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

	describe("filesystem tests", async () => {
		afterEach(() => {
			fs.rmSync('./images/image.jpg', { force: true });
		});
		beforeEach(() => {
			fs.rmSync('./images/image.jpg', { force: true });
		});

		test.only('should convert a buffer to an image file', async () => {
			const buffer = Buffer.from('test data');
			await expect(convertToImage(buffer)).resolves.toBe('./images/image.jpg');
			expect(fs.existsSync('./images/image.jpg')).toBe(true);
		});
	})



});