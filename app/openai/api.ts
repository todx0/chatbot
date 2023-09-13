import { openai, model, systemContent } from '../config.js';
import { roleContent } from '../types.js';
import { readFromDatabase, writeToDatabase } from '../helper.js'

export async function generateGptRespWithHistory(userRequest: string): Promise<string> {
	try {
		const userRoleContent: roleContent = { role: 'user', content: userRequest }
		await writeToDatabase(userRoleContent);
		const currentHistory = await readFromDatabase()
		currentHistory.unshift(systemContent)
		const response: any = await openai.createChatCompletion({
			model,
			messages: currentHistory
		});
		await writeToDatabase({ role: 'assistant', content: response });
		return response.data.choices[0].message.content;
	} catch (error) {
		return error.response.data.error.message;
	}
}
export async function generateGptResponse(userRequest: string): Promise<string> {
	try {
		const userRoleContent: roleContent = { role: 'user', content: userRequest }
		const response: any = await openai.createChatCompletion({
			model,
			messages: [userRoleContent]
		});
		await writeToDatabase(userRoleContent)
		await writeToDatabase({ role: 'assistant', content: response })
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
