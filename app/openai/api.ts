import { config, openai } from '../config.js';

export async function generateGptResponse(messages: string): Promise<string> {
	try {
		const response: any = await openai.createChatCompletion({
			model: 'gpt-3.5-turbo',
			messages: [
				{
					role: 'system',
					content: 'You are a chatbot. Sometimes, you are provided with conversation history where "Q:" is a question, "A:" is your answer or "User:" is user message and "You" is your answer to it. Never reply with "A:, Q:, User:, Person:"'
				},
				{
					role: 'user',
					content: messages
				}
			]
		});
		return response.data.choices[0].message.content;
	} catch (error: any) {
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
	} catch (error: any) {
		return error.response.data.error.message;
	}
}
export async function combineAnswers(answers: string[]): Promise<string> {
	const combinedAnswer = await generateGptResponse(`Combine array of answers to one. Reply in ${config.LANGUAGE}. \n ${answers}`);
	return combinedAnswer;
}
