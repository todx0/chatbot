import {
	expect, test, describe, jest, afterEach, beforeEach,
} from 'bun:test';
import { roleContent } from '../app/types';
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
	approximateTokenLength,
	readRoleContentFromDatabase
} from '../app/helper';

describe('helper functions', async () => {
	const testsData = ['message 1', '/recap 100'];

	test('retry - success before maximum retries', async () => {
		const asyncFn = jest.fn().mockResolvedValue('success');
		const result = await retry(asyncFn, 3);
		expect(result).toBe('success');
		expect(asyncFn).toHaveBeenCalledTimes(1);
	});

	describe('sqlite db tests', async () => {
		/*
		beforeEach(async () => {
		});
		afterEach(async () => {
		});
		*/
		test('create and trim records', async () => {
			const trimAmount = 10;
			const testData: roleContent = { role: 'user', content: 'test string' };
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
		const message = JSON.parse('{"originalArgs":{},"media":{"document":{}},"flags":8388992,"out":false,"mentioned":false,"mediaUnread":false,"silent":false,"post":false,"fromScheduled":false,"legacy":false,"editHide":false,"pinned":false,"noforwards":false,"id":1733,"fromId":{"userId":"137617550","className":"PeerUser"},"peerId":{"channelId":"1629921605","className":"PeerChannel"},"fwdFrom":null,"viaBotId":null,"replyTo":null,"date":1694683261,"message":"/q test","media":null,"replyMarkup":null,"entities":[{"offset":0,"length":2,"className":"MessageEntityBotCommand"}],"views":null,"forwards":null,"replies":{"flags":0,"comments":false,"replies":0,"repliesPts":1784,"recentRepliers":null,"channelId":null,"maxId":null,"readMaxId":null,"className":"MessageReplies"},"editDate":null,"postAuthor":null,"groupedId":null,"reactions":null,"restrictionReason":null,"ttlPeriod":null,"className":"Message"}');
		const messageOriginalArgs = JSON.parse('{"flags":312,"out":false,"mentioned":true,"mediaUnread":true,"silent":false,"post":false,"fromScheduled":false,"legacy":false,"editHide":false,"pinned":false,"noforwards":false,"id":1755,"fromId":{"userId":"137617550","className":"PeerUser"},"peerId":{"channelId":"1629921605","className":"PeerChannel"},"fwdFrom":null,"viaBotId":null,"replyTo":{"flags":2,"replyToScheduled":false,"replyToMsgId":1754,"replyToPeerId":null,"replyToTopId":1732,"className":"MessageReplyHeader"},"date":1694687980,"message":"ggggg","media":null,"replyMarkup":null,"entities":null,"views":null,"forwards":null,"replies":null,"editDate":null,"postAuthor":null,"groupedId":null,"reactions":null,"restrictionReason":null,"ttlPeriod":null}');
		const messageMediaDocument = JSON.parse('{"flags":1,"nopremium":false,"document":{"flags":1,"id":"5195285938384680024","accessHash":"-5958845760159246381","fileReference":{"type":"Buffer","data":[2,97,38,161,69,0,0,6,221,101,2,227,69,51,143,86,27,137,7,221,141,209,89,181,51,82,116,89,70]},"date":1694688069,"mimeType":"video/mp4","size":"176074","thumbs":[{"type":"i","bytes":{"type":"Buffer","data":[1,40,40,216,36,15,198,155,146,92,142,216,166,43,111,152,158,195,129,68,178,8,131,185,25,192,233,64,13,148,126,240,159,106,131,207,146,38,224,228,103,161,170,255,0,218,14,101,249,212,109,60,113,218,165,156,96,159,173,0,94,134,85,153,114,189,186,143,74,43,54,222,83,21,194,159,225,110,13,20,1,98,59,168,34,206,249,0,52,203,201,227,100,100,14,9,56,224,122,86,118,163,9,130,233,129,251,172,119,45,87,14,64,235,64,15,98,160,128,15,34,180,110,110,35,0,97,183,18,51,199,53,142,204,105,3,16,58,245,160,101,255,0,53,95,5,79,62,148,84,58,108,13,113,120,128,125,213,59,155,233,69,2,55,238,173,99,186,139,99,240,71,70,238,13,97,92,105,247,22,236,114,133,215,251,202,50,40,162,128,42,96,231,29,234,205,190,157,115,112,195,8,85,127,188,220,10,40,160,13,251,75,88,237,34,216,156,147,203,55,115,69,20,80,7]},"className":"PhotoStrippedSize"},{"type":"m","w":300,"h":300,"size":10572,"className":"PhotoSize"}],"videoThumbs":null,"dcId":2,"attributes":[{"flags":3,"roundMessage":true,"supportsStreaming":true,"duration":2,"w":300,"h":300,"className":"DocumentAttributeVideo"}],"className":"Document"},"ttlSeconds":null,"className":"MessageMediaDocument"}');
		message.media = messageMediaDocument;
		message.originalArgs = messageOriginalArgs;
		const messageNotSeenRes = messageNotSeen(message);
		const somebodyMentionedRes = somebodyMentioned(message);
		const canTranscribeMediaRes = canTranscribeMedia(message.media);
		const shouldTranscribeMediaRes = shouldTranscribeMedia(message);
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
