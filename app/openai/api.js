const { openai } = require('../../config');

async function generateGptResponse(messages) {
	try {
		const response = await openai.createChatCompletion({
			model: 'gpt-3.5-turbo',
			messages: [
				{
					role: 'user',
					content: messages
				}
			]
		});
		return response.data.choices[0].message.content;
	} catch (error) {
		// throw new Error(error.response.data.error.message);
		return error.response.data.error.message;
	}
}

async function createImageFromPrompt(text) {
	try {
		const response = await openai.createImage({
			prompt: text,
			n: 1,
			size: '1024x1024',
			// responseFormat: 'url'
		});
		return response.data.data[0].url;
	} catch (error) {
		return error.response.data.error.message;
	}
}

module.exports = {
	generateGptResponse,
	createImageFromPrompt
};
