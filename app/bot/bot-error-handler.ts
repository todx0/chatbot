import type { TelegramClient } from 'telegram';

export class BotErrorHandler {
	constructor(private client: TelegramClient) {}

	async handleError(peer: string, error: Error): Promise<void> {
		await this.client.sendMessage(`-${peer}`, { message: String(error.message) });
	}
}
