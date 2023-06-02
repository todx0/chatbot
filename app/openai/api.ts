import { config, openai, chatBotInstructions } from '../config.js';

export async function generateGptResponse(messages: string): Promise<string> {
	const maxRetries = 3;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response: any = await openai.createChatCompletion({
				model: 'gpt-3.5-turbo',
				messages: [
					{
						role: 'system',
						content: chatBotInstructions
					},
					{
						role: 'user',
						content: messages
					}
				]
			});

			return response.data.choices[0].text;
		} catch (error: any) {
			console.error(`Error: ${error.response?.data?.error?.message}. Retrying...`);

			if (attempt === maxRetries) {
				throw new Error(error.response?.data?.error?.message || 'Unknown error occurred');
			}
		}
	}

	throw new Error('Something went wrong and we never got a response from OpenAI.');
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
interface openAiRequest {
	currentHistory: string,
	messageResponse: string,
	replyTo: string
}
export async function formOpenAiRequest(r: openAiRequest): Promise<string> {
	return `This is the conversation history: ${r.currentHistory} \n This is your message: ${r.messageResponse} \n Here is a person's reply to your message: ${r.replyTo}. Reply to the person's message in a sarcastic tone.`;
}
