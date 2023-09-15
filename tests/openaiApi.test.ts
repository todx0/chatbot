import {
	expect, test, describe, jest, afterEach, beforeEach, mock, spyOn
} from 'bun:test';
import { AxiosResponse } from 'axios';
import { CreateChatCompletionResponse, ImagesResponse } from 'openai/dist/api';
import { openai } from '../app/config';
import {
	generateGptResponse,
	generateGptResponses,
	createImageFromPrompt,
	generateGptRespWithHistory,
} from '../app/modules/openai/api';

describe('main functions', () => {
	const mockResponseContent = 'Mock response content';
	const mockImage = 'https://oaidalleapiprodscus.blob.core.windows.net/private/org-TEST/user-TEST/img-TEST.png';

	beforeEach(async () => {
		const headers = JSON.parse('{"Accept":"application/json, text/plain, */*","Content-Type":"application/json","User-Agent":"OpenAI/NodeJS/3.3.0","Authorization":"Bearer sk-test","OpenAI-Organization":"TEST","Content-Length":69}');
		const mockChatCompletionResponse: AxiosResponse<CreateChatCompletionResponse, any> = {
			data: {
				id: 'testId',
				object: 'chat.completion',
				created: 69,
				model: 'mock',
				choices: [
					{
						message: {
							role: 'assistant',
							content: mockResponseContent
						}
					}
			  ]
			},
			status: 200,
			statusText: 'OK',
			headers: {},
			config: { headers }
		};
		const mockCreateImage: AxiosResponse<ImagesResponse, any> = {
			data: {
				created: 69,
				data: [
				  {
						url: mockImage
				  }
				]
			  },
			status: 200,
			statusText: 'OK',
			headers: {},
			config: { headers }
		};
		mock(() => ({
			insertToMessages: jest.fn(() => {})
		}));
		//@ts-ignore
		spyOn(openai, 'createChatCompletion').mockImplementation(() => mockChatCompletionResponse);
		//@ts-ignore
		spyOn(openai, 'createImage').mockImplementation(() => mockCreateImage);
	});
	afterEach(async () => {
	});

	test('mock generateGptResponse', async () => {
		const response = await generateGptResponse('test request string');
		expect(response).toBe(mockResponseContent);
	});

	test('mock generateGptRespWithHistory', async () => {
		const response = await generateGptRespWithHistory('test request string');
		expect(response).toBe(mockResponseContent);
	});

	test('mock generateGptResponses', async () => {
		const messages = ['msg1', 'msg2', 'msg3'];
		mock(() => ({
			generateGptResponse: jest.fn(() => mockResponseContent)
		}));
		const response = await generateGptResponses('test request string', messages);
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
