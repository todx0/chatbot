import { openai, model, systemContent } from '../config.js';
import { gptRequest } from '../types.js';


export async function generateGptRespWithHistory(request: gptRequest): Promise<string> {
	try {
		const { conversationHistory, userRequest } = request;
		const userRequestObject = { role: 'user', content: userRequest };
		conversationHistory.unshift(systemContent)
		conversationHistory.push(userRequestObject);

		const response: any = await openai.createChatCompletion({
			model,
			messages: conversationHistory
		});
		return response.data.choices[0].message.content;
	} catch (error) {
		return error.response.data.error.message;
	}
}
export async function generateGptResponse(message: string): Promise<string> {
	try {
		const response: any = await openai.createChatCompletion({
			model,
			messages: [{ role: 'user', content: message }]
		});
		return response.data.choices[0].message.content;
	} catch (error) {
		return error.response.data.error.message;
	}
}
export async function generateGptResponses(requestText: string, messages: string[]): Promise<string[]> {
	const promises = messages.map((innerArr) => generateGptResponse(`${requestText} ${innerArr}`));
	return Promise.all(promises);
}
export async function createImageFromPrompt(text: string): Promise<string> {
	try {
		const response: any = await openai.createImage({
			prompt: text,
			n: 1,
			size: '1024x1024',
		});
		return response.data.data[0].url;
	} catch (error) {
		return error.response.data.error.message;
	}
}
export async function combineAnswers(answers: string[]): Promise<string> {
	const combinedAnswer = await generateGptResponse(`Combine array of answers to one. \n ${answers}`);
	return combinedAnswer;
}
