import { Api } from 'telegram';
import type { TelegramClient } from 'telegram';

export class Transcriptions {
	constructor(private client: TelegramClient) {}

	async transcribeAudioMessage(msgId: number, groupId: string): Promise<Api.messages.TranscribedAudio> {
		const transcribeAudio = new Api.messages.TranscribeAudio({
			peer: groupId,
			msgId,
		});
		const result = await this.client.invoke(transcribeAudio);
		return result;
	}

	/* 	async transcribeMedia(msgData: MessageData) {
		const transcribedAudio = await this.waitForTranscription(msgData.messageId, msgData.groupId);
		if (transcribedAudio) {
			throw Error('Enable and fix line below.');
			// await this.processMessage(transcribedAudio, groupId);
		}
	}

	async waitForTranscription(messageId: number, groupId: string): Promise<string> {
		const response = await retry(() => this.transcribeAudioMessage(messageId, groupId), 3);
		if (response.text !== translations.transcriptionError) {
			return response.text;
		}
		return '';
	} */
}
