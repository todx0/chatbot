const axios = require('axios');
const fs = require('fs');

function sleep(ms) {
	// eslint-disable-next-line no-promise-executor-return
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
async function filterMessages(messages) {
	return messages.filter((message) => !message.includes('/recap') && message.length < 300 && message.length);
}
async function approximateTokenLength(array) {
	const totalLength = array.map((str) => str.length).reduce((accumulator, currentValue) => accumulator + currentValue);
	return totalLength;
}
async function convertFilteredMessagesToString(array) {
	return array.toString();
}
async function splitMessageInChunks(message) {
	const maxChunkSize = 3000;
	const messageLength = message.length;
	const chunkCount = Math.ceil(messageLength / maxChunkSize);
	const chunks = [];

	for (let i = 0; i < chunkCount; i++) {
		const start = i * maxChunkSize;
		const end = start + maxChunkSize;
		const chunk = message.substring(start, end);

		chunks.push(chunk);
	}
	return chunks;
}
module.exports = {
	sleep,
	downloadFile,
	convertToImage,
	filterMessages,
	approximateTokenLength,
	convertFilteredMessagesToString,
	splitMessageInChunks
};
