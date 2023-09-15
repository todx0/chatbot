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
	const mockImage = 'https://oaidalleapiprodscus.blob.core.windows.net/private/org-25EUekyHinNOumFccWsaSMNp/user-FX1HxrEvbPTBhpULVmMuNoAv/img-mXItIHH2lMLXZnbDYY6LPHA6.png?st=2023-09-15T10%3A40%3A26Z&se=2023-09-15T12%3A40%3A26Z&sp=r&sv=2021-08-06&sr=b&rscd=inline&rsct=image/png&skoid=6aaadede-4fb3-4698-a8f6-684d7786b067&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2023-09-15T06%3A16%3A55Z&ske=2023-09-16T06%3A16%3A55Z&sks=b&skv=2021-08-06&sig=m6n0ljyg8d72Sj5rPM2UvXcR90JGn2OuTTD92KwzGbg%3D';
	beforeEach(async () => {
		const headers = JSON.parse('{"Accept":"application/json, text/plain, */*","Content-Type":"application/json","User-Agent":"OpenAI/NodeJS/3.3.0","Authorization":"Bearer sk-test","OpenAI-Organization":"TEST","Content-Length":68}');
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
		spyOn(openai, 'createChatCompletion').mockImplementation(() => mockChatCompletionResponse);
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
