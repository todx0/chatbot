const history = './history.txt';
const fs = require('fs');

async function writeToHistoryFile(line) {
	const fileName = history;
	const maxLines = 10;
	try {
		const oldContent = fs.readFileSync(fileName, { encoding: 'utf-8' }).split('\n');
		const newContent = [...oldContent.slice(-(maxLines - 1)), line];
		fs.writeFileSync(fileName, newContent.join('\n'));
	} catch (error) {
		console.error(`Error while writing to file: ${error.message}`);
	}
}
async function readHistoryFile(fileName) {
	try {
		const content = fs.readFileSync(fileName, { encoding: 'utf-8' });
		return content;
	} catch (error) {
		console.error(`Error while reading file "${fileName}": ${error.message}`);
		return null;
	}
}
async function clearHistory() {
	fs.truncate(history, 0, () => { console.log('History cleared'); });
}
async function getHistory() {
	const fileContent = await readHistoryFile(history);
	if (fileContent) return `Your previous answers are: ${fileContent}`;
	return '';
}

module.exports = {
	writeToHistoryFile,
	readHistoryFile,
	clearHistory,
	getHistory
};
