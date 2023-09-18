import {
	expect, test, describe, jest, mock, spyOn, beforeAll, afterAll
} from 'bun:test';
import { openai } from '../app/config';
import {
	generateGptResponse,
	generateGptResponses,
	createImageFromPrompt,
	generateGptRespWithHistory,
} from '../app/modules/openai/api';
import {
	mockImage,
	mockCreateImage,
	mockRequestContent,
	mockArrayOfMessages,
	mockResponseContent,
	mockChatCompletionResponse,
} from './testData/testDataForMocks';

describe('main functions', () => {
	beforeAll(async () => {
		//@ts-ignore
		spyOn(openai, 'createChatCompletion').mockImplementation(() => mockChatCompletionResponse);
		//@ts-ignore
		spyOn(openai, 'createImage').mockImplementation(() => mockCreateImage);
	});
	afterAll(async () => {
		spyOn(openai, 'createChatCompletion').mockClear();
		spyOn(openai, 'createImage').mockClear();
	});

	test('mock generateGptResponse', async () => {
		const response = await generateGptResponse(mockRequestContent);
		expect(response).toBe(mockResponseContent);
	});

	test('mock generateGptRespWithHistory', async () => {
		const response = await generateGptRespWithHistory(mockRequestContent);
		expect(response).toBe(mockResponseContent);
	});

	test('mock generateGptResponses', async () => {
		mock(() => ({
			generateGptResponse: jest.fn(() => mockResponseContent)
		}));
		const response = await generateGptResponses(mockRequestContent, mockArrayOfMessages);
		expect(response).toBeArrayOfSize(3);
		response.forEach(res => {
			expect(res).toEqual(mockResponseContent);
		});
	});

	test('mock createImageFromPrompt', async () => {
		const response = await createImageFromPrompt('test request string');
		expect(response).toBe(mockImage);
	});
});
