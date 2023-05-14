const { openai, LANGUAGE } = require('../../config');
const openAiTextRequest = `Parse conversation. Generate detailed summary in ${LANGUAGE} language. Ignore profanity but keep context: `;

async function generateGptResponse(messages) {
	try {
		const response = await openai.createChatCompletion({
			model: 'gpt-3.5-turbo',
			messages: [
				{
					role: 'user',
					content: `${openAiTextRequest} ${messages}`
				}
			]
		});
		return response.data.choices[0].message.content;
	} catch (error) {
		// throw new Error(error.response.data.error.message);
		return error.response.data.error.message;
	}
}

module.exports = {
	generateGptResponse
};
