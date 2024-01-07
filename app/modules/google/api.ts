import {
	genAImodel,
	maxHistoryLength,
	safetySettings,
	recapTextRequest,
} from '../../config';
import { RoleParts } from '../../types';
import {
	readRolePartsFromDatabase,
	 insertToMessages,
} from '../../helper';

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

		let responseText = response.text();
		if (!responseText) responseText = 'Бля я хуй знает дядя.';

		await insertToMessages(userRoleContent);
		await insertToMessages({ role: 'model', parts: responseText });

		return responseText;
	} catch (error: any) {
		return error.message;
	}
}

export async function generateMultipleResponses(userRequests: string[]): Promise<string[]> {
	return Promise.all(
		userRequests.map(async (chunk) => generateGenAIResponse(`${recapTextRequest} ${chunk}`)),
	  );
}

export async function combineResponses(responses: string[]): Promise<string> {
	const combinedResponseArray = responses.join(' ____ ');
	const combinedResponse = await generateGenAIResponse(`Combine responses separated with '____' into one: ${combinedResponseArray}`);
	return combinedResponse;
}

export async function returnCombinedAnswerFromMultipleResponses(chunks: string[]): Promise<string> {
	const googleResponses = await generateMultipleResponses(chunks);
	const answer = await combineResponses(googleResponses);
	return answer;
}
