const { createImageFromPrompt } = require('./app/openai/api');

(async function () {
	try {
		const response = await createImageFromPrompt('write a dog');
		console.log(response);
	} catch (error) {
		console.error(error);
	}
}());
