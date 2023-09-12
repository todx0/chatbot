import { truncate } from 'fs';
import { roleContent } from '../types.js';
import { maxHistoryLength, historyFile } from '../config.js';

export async function writeToHistoryFile(line: roleContent, fileName: string = historyFile): Promise<void> {
	try {
		const file = Bun.file(fileName, { type: "application/json" });
		if (!file.size) Bun.write(fileName, '')

		const oldContent = (await file.text()).trim()
		let newContent: string;

		if (oldContent === '') {
			newContent = JSON.stringify([line]); // Add square brackets around line when writing for the first time
		} else {
			const lines = JSON.parse(oldContent);
			if (!Array.isArray(lines)) {
				throw new Error('File content is not a valid JSON array');
			}
			if (lines.length >= maxHistoryLength) {
				lines.shift();
			}
			lines.push(line);
			newContent = JSON.stringify(lines);
		}
		Bun.write(fileName, newContent)
	} catch (error any) {
		console.error(`Error while writing to file: ${error.message}`);
	}
}
export async function readHistoryFile(fileName: string = historyFile): Promise<any[] | null> {
	try {
		const file = Bun.file(fileName, { type: "application/json" });
		if (!file.size) Bun.write(fileName, '')
		const content = (await file.text()).trim()

		if (!content) {
			return [];
		}
		const history = JSON.parse(content);
		if (!Array.isArray(history)) {
			throw new Error('File content is not a valid JSON array');
		}
		return history;
	} catch (error any) {
		console.error(`Error while reading file "${fileName}": ${error.message}`);
		return null;
	}
}
export async function clearHistory(fileName: string = historyFile): Promise<void> {
	truncate(fileName, 0, () => { console.log('History cleared'); });
}
export async function getHistory(fileName: string): Promise<any[]> {
	const fileContent = await readHistoryFile(fileName);
	if (fileContent) {
		return fileContent;
	}
	return [];
}
