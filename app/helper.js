const axios = require('axios');
const fs = require('fs');

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
async function downloadFile(url) {
	const response = await axios.get(url, { responseType: 'arraybuffer' });
	return Buffer.from(response.data, 'binary');
}
async function convertToImage(buffer) {
	if (buffer instanceof Buffer) {
		const path = './images/image.jpg';
		fs.writeFileSync(path, buffer);
		return path;
	}
	throw new Error('Not a buffer');
}
function filterMessages(messages) {
	return messages.filter((message) => !message.includes('/recap') && message.length < 300 && message.length);
}
async function truncatePrompt(array) {
	const mid = Math.ceil(array.length / 2);
	const firstHalf = array.slice(0, mid);
	const secondHalf = array.slice(mid);
	return [firstHalf, secondHalf];
}
module.exports = {
	sleep,
	downloadFile,
	convertToImage,
	filterMessages,
	truncatePrompt
};
