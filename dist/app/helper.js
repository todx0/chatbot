import axios from 'axios';
import fs from 'fs';
export function sleep(ms) {
    // eslint-disable-next-line no-promise-executor-return
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function downloadFile(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
}
export async function convertToImage(buffer) {
    if (buffer instanceof Buffer) {
        const path = './images/image.jpg';
        fs.writeFileSync(path, buffer, { flag: 'w' });
        return path;
    }
    throw new Error('Not a buffer');
}
export async function filterMessages(messages) {
    return messages.filter((message) => !message.includes('/recap') && message.length < 300 && message.length);
}
export async function approximateTokenLength(messages) {
    const totalLength = messages.map((str) => str.length).reduce((accumulator, currentValue) => accumulator + currentValue);
    return totalLength;
}
export async function convertFilteredMessagesToString(messages) {
    return messages.toString();
}
export async function splitMessageInChunks(message) {
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
