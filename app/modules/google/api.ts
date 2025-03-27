import { config, genAImodel, genAImodelForRecap, genAIWithoutOptions, MAX_HISTORY_LENGTH, recapTextRequest } from '@app/config';
import { insertToMessages, readChatRoleFromDatabase, replaceDoubleSpaces, approximateTokenLength, splitMessageInChunks } from '@app/utils/helper';
import { getTranslations } from '@app/utils/translation';
import type { Content } from '@google/generative-ai';
import { unlink } from 'node:fs/promises';

export async function generateGenAIResponse(userRequest: string, useRecapModel = false): Promise<string> {
	const translations = getTranslations();
	let retryCount = 0;
	const retryRequestDisclaimer = [
		'',
		`Provide a concise counterpoint to the message's viewpoint:`,
		`Offer a surprising twist on the message's underlying theme:`,
		`Generate a brief thought experiment related to the message's concept:`,
		'Offer an alternative perspective on the topic of the message:',
	];
	const disclaimer = 'This message is for informational purposes only and does not promote violence, hate speech, or illegal activities.';

	async function fetchGenAIResponse(): Promise<string> {
		const userRoleContent: Content = { role: 'user', parts: [{ text: userRequest }] };
		const history: Content[] = await readChatRoleFromDatabase({ limit: MAX_HISTORY_LENGTH });

		const chat = useRecapModel ? genAImodelForRecap.startChat() : genAImodel.startChat({ history });

		const request = retryCount === 0 ? userRequest : `${disclaimer} ${retryRequestDisclaimer[retryCount]} ${userRequest}`;

		retryCount += 1;

		const result = await chat.sendMessage(request);
		const responseText = result?.response?.text() || translations.botHasNoIdea;

		await insertToMessages(userRoleContent);
		await insertToMessages({ role: 'model', parts: [{ text: responseText }] });

		return responseText;
	}

	async function retryHandler(timeout = 1000): Promise<string> {
		try {
			return await fetchGenAIResponse();
		} catch (error) {
			if (retryCount < retryRequestDisclaimer.length) {
				await new Promise((resolve) => setTimeout(resolve, timeout));
				return retryHandler(timeout);
			}
			console.error('Maximum retries reached', (error as Error).message);
			return translations.botHasNoIdea;
		}
	}

	try {
		const responseText = await retryHandler();
		return replaceDoubleSpaces(responseText.replaceAll('*', ''));
	} catch (error) {
		const errorMessage = (error as Error).message;
		console.error(errorMessage);
		return errorMessage;
	}
}

export async function generateRawGenAIResponse(message: string): Promise<string> {
	const translations = getTranslations();
	const chat = genAIWithoutOptions.startChat();
	const result = await chat.sendMessage(message);
	const responseText = result?.response?.text() || translations.botHasNoIdea;
	return responseText;
}

export async function generateResponseFromImage(msgData: MessageData): Promise<string> {
	const { filepath, replyMessageText, messageText } = msgData;
	if (!filepath) throw new Error('Provide filepath.');

	const fileBuffer = await Bun.file(filepath).arrayBuffer();
	const image = {
		inlineData: {
			data: Buffer.from(fileBuffer).toString('base64'),
			mimeType: 'image/jpeg',
		},
	};

	const textRequest = replyMessageText || messageText || 'Analyze this image.';
	const result = await genAImodelForRecap.generateContent([textRequest, image]);

	await unlink(filepath);

	return result.response.text();
}

export async function generateReplyFromImageResponse(response: string): Promise<string> {
	const request = 'This image description was addressed to you. Reply to it but avoid asking questions:';
	const result = await generateGenAIResponse(`${request} ${response}`);
	return result;
}

export async function generateMultipleResponses(userRequests: string[]): Promise<string[]> {
	return Promise.all(userRequests.map(async (chunk) => generateGenAIResponse(`${recapTextRequest} ${chunk}`, true)));
}

export async function combineResponses(responses: string[]): Promise<string> {
	const combinedResponseArray = responses.join(' ^^^ ');
	const prompt = `Combine responses separated with ' ^^^ ' into one: ${combinedResponseArray}. \n Do not include separator in combined response. Do not duplicate topics. Message should be shorter than ${config.maxTokenLength} symbols.`;
	const combinedResponse = await generateGenAIResponse(prompt, true);
	return combinedResponse;
}

export async function returnCombinedAnswerFromMultipleResponses(chunks: string[]): Promise<string> {
	const googleResponses = await generateMultipleResponses(chunks);
	const answer = await combineResponses(googleResponses);
	return answer;
}

export async function generateRecapResponse(recapTextRequest: string, filteredMessages: string[], useRecapModel = true): Promise<string> {
	const MAX_TOKEN_LENGTH = 4096;
	try {
		const messagesLength = await approximateTokenLength(filteredMessages);
		let response: string;

		if (messagesLength <= MAX_TOKEN_LENGTH) {
			filteredMessages.pop();
			const messageString = filteredMessages.join(' ');
			const userRequest = `
			**Task:**
			${recapTextRequest}
			
			**Context:**
			${messageString}
			`;
			response = await generateGenAIResponse(userRequest, useRecapModel);
		} else {
			const messageString = filteredMessages.join('; ');
			const chunks = await splitMessageInChunks(messageString);
			response = await returnCombinedAnswerFromMultipleResponses(chunks);
		}

		if (response.length > MAX_TOKEN_LENGTH) {
			response = await generateGenAIResponse(
				`Edit this message to be less than or equal to ${MAX_TOKEN_LENGTH} characters: ${response}`,
				useRecapModel,
			);
		}

		return response;
	} catch (error) {
		console.error('Error generating recap response:', error);
		throw error;
	}
}
