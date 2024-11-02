import { Content } from '@google/generative-ai';
import { unlink } from 'node:fs/promises';
import {
  config,
  genAImodel,
  genAImodelForRecap,
  genAIWithoutOptions,
  MAX_HISTORY_LENGTH,
  recapTextRequest,
} from '../../config';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { MessageData } from '../../types';
import { insertToMessages, readChatRoleFromDatabase, replaceDoubleSpaces } from '../../utils/helper';
import { getTranslations } from '../../utils/translation';

export async function generateGenAIResponse(userRequest: string, recap = false): Promise<string> {
  const translations = getTranslations();
  let retryCount = 0;
  const retryRequestDisclaimer = [
    ``,
    `Provide a concise counterpoint to the message's viewpoint:`,
    `Offer a surprising twist on the message's underlying theme:`,
    `Generate a brief thought experiment related to the message's concept:`,
    `Offer an alternative perspective on the topic of the message:`,
  ];
  const disclaimer =
    `This message is for informational purposes only and does not promote violence, hate speech, or illegal activities.`;

  async function fetchGenAIResponse(): Promise<string> {
    const userRoleContent: Content = { role: 'user', parts: [{ text: userRequest }] };
    const history: Content[] = await readChatRoleFromDatabase({ limit: MAX_HISTORY_LENGTH });

    const chat = recap ? genAImodelForRecap.startChat() : genAImodel.startChat({ history });

    const request = retryCount === 0
      ? userRequest
      : `${disclaimer} ${retryRequestDisclaimer[retryCount]} ${userRequest}`;
    retryCount += 1;

    const result = await chat.sendMessage(request);
    const responseText = result?.response?.text() || translations['botHasNoIdea'];

    await insertToMessages(userRoleContent);
    await insertToMessages({ role: 'model', parts: [{ text: responseText }] });

    return responseText;
  }

  async function retryHandler(): Promise<string> {
    try {
      return await fetchGenAIResponse();
    } catch (error: any) {
      if (retryCount < retryRequestDisclaimer.length) {
        return retryHandler();
      } else {
        console.error('Maximum retries reached', error.message);
        return translations['botHasNoIdea'];
      }
    }
  }

  try {
    const responseText = await retryHandler();
    return replaceDoubleSpaces(responseText);
  } catch (error: any) {
    return ErrorHandler.handleError(error);
  }
}

export async function generateRawGenAIResponse(message: string): Promise<string> {
  const translations = getTranslations();
  const chat = genAIWithoutOptions.startChat();
  const result = await chat.sendMessage(message);
  const responseText = result?.response?.text() || translations['botHasNoIdea'];
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
  const request = 'This image description was addressed to you. Reply to it:';
  const result = await generateGenAIResponse(`${request} ${response}`);
  return result;
}

export async function generateMultipleResponses(userRequests: string[]): Promise<string[]> {
  return Promise.all(
    userRequests.map(async (chunk) => generateGenAIResponse(`${recapTextRequest} ${chunk}`, true)),
  );
}

export async function combineResponses(responses: string[]): Promise<string> {
  const combinedResponseArray = responses.join(' ^^^ ');
  const prompt =
    `Combine responses separated with ' ^^^ ' into one: ${combinedResponseArray}. \n Do not include separator in combined response. Do not duplicate topics. Message should be shorter than ${config.maxTokenLength} symbols.`;
  const combinedResponse = await generateGenAIResponse(prompt, true);
  return combinedResponse;
}

export async function returnCombinedAnswerFromMultipleResponses(chunks: string[]): Promise<string> {
  const googleResponses = await generateMultipleResponses(chunks);
  const answer = await combineResponses(googleResponses);
  return answer;
}
