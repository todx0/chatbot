import { Content } from '@google/generative-ai';
import { unlink } from 'node:fs/promises';
import { config, genAImodel, genAImodelForRecap, MAX_HISTORY_LENGTH, recapTextRequest } from '../../config';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { MessageObject } from '../../types';
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

    const chat = !recap
      ? genAImodel.startChat({ history })
      : genAImodelForRecap.startChat();

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
      if (error.message.includes('Response was blocked due to OTHER')) {
        if (retryCount < retryRequestDisclaimer.length) {
          return retryHandler();
        } else {
          console.error('Maximum retries reached with disclaimer', error.message);
          return translations['botHasNoIdea'];
        }
      } else {
        if (retryCount < retryRequestDisclaimer.length) {
          return retryHandler();
        } else {
          console.error('Maximum retries reached', error.message);
          return translations['botHasNoIdea'];
        }
      }
    }
  }

  try {
    const responseText = await retryHandler();
    const formatedText = replaceDoubleSpaces(responseText);
    return formatedText;
  } catch (error: any) {
    return ErrorHandler.handleError(error);
  }
}

export async function generateResponseFromImage(messageObj: MessageObject): Promise<string> {
  if (!messageObj.filepath) throw Error('Provide filepath.');
  const file = await Bun.file(messageObj.filepath).arrayBuffer();
  const image = {
    inlineData: {
      data: Buffer.from(file).toString('base64'),
      mimeType: 'image/jpeg',
    },
  };
  let replyMessageContent = messageObj.replyMessageContent
    ? messageObj.replyMessageContent
    : 'Analyze this image.';
  // const result = await genAImodel.generateContent([replyMessageContent, image]);
  const result = await genAImodelForRecap.generateContent([replyMessageContent, image]);

  await unlink(messageObj.filepath);
  return result.response.text();
}

export async function generateMultipleResponses(userRequests: string[]): Promise<string[]> {
  return Promise.all(
    userRequests.map(async (chunk) => generateGenAIResponse(`${recapTextRequest} ${chunk}`, true)),
  );
}

export async function combineResponses(responses: string[]): Promise<string> {
  const combinedResponseArray = responses.join(' ^^^ ');
  const combinedResponse = await generateGenAIResponse(
    `Combine responses separated with ' ^^^ ' into one: ${combinedResponseArray}. \n Do not include separator in combined response. Do not duplicate topics. Message should be shorter than ${config.maxTokenLength} symbols.`,
    true,
  );
  return combinedResponse;
}

export async function returnCombinedAnswerFromMultipleResponses(chunks: string[]): Promise<string> {
  const googleResponses = await generateMultipleResponses(chunks);
  const answer = await combineResponses(googleResponses);
  return answer;
}
