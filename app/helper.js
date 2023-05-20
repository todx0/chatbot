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
async function filterMessages(messages) {
	return messages.filter((message) => !message.includes('/recap') && message.length < 300 && message.length);
}
async function truncatePrompt(array) {
	const mid = Math.ceil(array.length / 2);
	const firstHalf = array.slice(0, mid);
	const secondHalf = array.slice(mid);
	return [firstHalf, secondHalf];
}
async function trimToMaxLength(arr) {
	const maxLength = 2000;
	let currentLength = 0;
	let tempArr = [];
	const result = [];

	for (let i = 0; i < arr.length; i++) {
		const lengthToAdd = Math.round((arr[i].length / arr.join('').length) * maxLength);

		if (currentLength + lengthToAdd > maxLength) {
			result.push(tempArr);
			tempArr = [];
			currentLength = 0;
		}
		tempArr.push(arr[i]);
		currentLength += lengthToAdd;
	}
	if (tempArr.length > 0) {
		result.push(tempArr);
	}
	return result;
}
async function approximateTokenLength(array) {
	const totalLength = array.map((str) => str.length).reduce((accumulator, currentValue) => accumulator + currentValue);
	return totalLength;
}
module.exports = {
	sleep,
	downloadFile,
	convertToImage,
	filterMessages,
	truncatePrompt,
	approximateTokenLength,
	trimToMaxLength
};
