import {
	openai, model, systemContent, temperature, maxHistoryLength,
} from '../../config';
import { RoleContent } from '../../types';
import { readRoleContentFromDatabase, insertToMessages, trimMessagesTable } from '../../helper';

export async function generateGptRespWithHistory(userRequest: string): Promise<string> {
	try {
		const userRoleContent: RoleContent = { role: 'user', content: userRequest };
		await insertToMessages(userRoleContent);
		const currentHistory = await readRoleContentFromDatabase({ limit: maxHistoryLength });
		currentHistory.unshift(systemContent);

		const response: any = await openai.createChatCompletion({
			model,
			temperature,
			messages: currentHistory,
		});
		const responseContent = response.data.choices[0].message.content;
		await insertToMessages({ role: 'assistant', content: responseContent });
		return responseContent;
	} catch (error: any) {
		return error?.response?.data?.error?.message;
	}
}

export async function generateGptResponse(userRequest: string): Promise<string> {
	try {
		const userRoleContent: RoleContent = { role: 'user', content: userRequest };
		const response: any = await openai.createChatCompletion({
			model,
			temperature,
			messages: [userRoleContent],
		});
		const responseContent = response.data.choices[0].message.content;
		await insertToMessages(userRoleContent);
		await insertToMessages({ role: 'assistant', content: responseContent });
		return response.data.choices[0].message.content;
	} catch (error: any) {
		return error?.response?.data?.error?.message;
	}
}

export async function generateGptResponses(requestText: string, messages: string[]): Promise<string[]> {
	try {
		const promises = messages.map((innerArr) => generateGptResponse(`${requestText} ${innerArr}`));
		return await Promise.all(promises);
	} catch (error: any) {
		return error?.response?.data?.error?.message;
	}
}

export async function createImageFromPrompt(text: string): Promise<string> {
	try {
		const response: any = await openai.createImage({
			prompt: text,
			n: 1,
			size: '1024x1024',
		});
		return response.data.data[0].url;
	} catch (error: any) {
		return error?.response?.data?.error?.message;
	}
}

export async function combineAnswers(answers: string[]): Promise<string> {
	const combinedAnswer = await generateGptResponse(`Combine array of answers to one. \n ${answers}`);
	return combinedAnswer;
}
