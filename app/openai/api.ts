import { openai, LANGUAGE } from '../../config';

export async function generateGptResponse(messages: string): Promise<string> {
	try {
		const response: any = await openai.createChatCompletion({
			model: 'gpt-3.5-turbo',
			messages: [
				{
					role: 'user',
					content: messages
				}
			]
		});
		return response.data.choices[0].message.content;
	} catch (error: any) {
		// throw new Error(error.response.data.error.message);
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
			// responseFormat: 'url'
		});
		return response.data.data[0].url;
	} catch (error: any) {
		return error.response.data.error.message;
	}
}
export async function combineAnswers(answers: string[]): Promise<string> {
	const combinedAnswer = await generateGptResponse(`Combine array of answers to one. Reply in ${LANGUAGE}. \n ${answers}`);
	return combinedAnswer;
}
