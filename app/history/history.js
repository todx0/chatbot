const qHistory = 'app/history/qhistory.txt';
const replHistory = 'app/history/replhistory.txt';
const fs = require('fs');

async function writeToHistoryFile(line, fileName) {
	const maxLines = 15;
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
async function clearHistory(fileName) {
	fs.truncate(fileName, 0, () => { console.log('History cleared'); });
}
async function getHistory(fileName) {
	const fileContent = await readHistoryFile(fileName);
	if (fileContent) return `Your previous answers are: ${fileContent}`;
	return '';
}

module.exports = {
	writeToHistoryFile,
	readHistoryFile,
	clearHistory,
	getHistory,
	qHistory,
	replHistory
};
