import { AxiosResponse } from 'axios';
import { CreateChatCompletionResponse, ImagesResponse } from 'openai/dist/api';

export const mockArrayOfMessages = ['msg1', 'msg2', 'msg3'];
export const longMockArrayOfMessages = ['msg1', 'msg2', 'msg3', 'msg4', 'msg5', 'msg6', 'msg7', 'msg8', 'msg9', 'msg10', 'msg11'];
export const mockResponseContent = 'Mock response content';
export const mockRequestContent = 'test request content';
export const mockImage = 'https://oaidalleapiprodscus.blob.core.windows.net/private/org-TEST/user-TEST/img-TEST.png';
export const headers = JSON.parse('{"Accept":"application/json, text/plain, */*","Content-Type":"application/json","User-Agent":"OpenAI/NodeJS/3.3.0","Authorization":"Bearer sk-test","OpenAI-Organization":"TEST","Content-Length":69}');
export const mockChatCompletionResponse: AxiosResponse<CreateChatCompletionResponse, any> = {
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
export const mockCreateImage: AxiosResponse<ImagesResponse, any> = {
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
