import {
	genAImodel, maxHistoryLength, safetySettings,
} from '../../config';
import { RoleParts } from '../../types';
import { readRolePartsFromDatabase, insertToMessages } from '../../helper';

export async function generateGenAIResponse(userRequest: string): Promise<string> {
	try {
		const userRoleContent: RoleParts = { role: 'user', parts: userRequest };
		const history = await readRolePartsFromDatabase({ limit: maxHistoryLength });

		const chat = genAImodel.startChat({
			history,
			safetySettings,
		});
		const result = await chat.sendMessage(userRequest);
		const response = await result.response;
		const responseText = response.text();

		await insertToMessages(userRoleContent);
		await insertToMessages({ role: 'model', parts: responseText });

		return responseText;
	} catch (error: any) {
		return error.message;
	}
}

export async function test() { return true; }
