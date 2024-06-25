import { Content } from '@google/generative-ai';
import { config, genAImodel, maxHistoryLength, recapTextRequest, safetySettings } from '../../config';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { insertToMessages, readChatRoleFromDatabase, replaceDoubleSpaces, retry } from '../../utils/helper';
import { getTranslations } from '../../utils/translation';

export async function generateGenAIResponse(userRequest: string): Promise<string> {
  const translations = getTranslations();
  let retryCount = 0;
  let retryRequestDisclaimer = [
    ``,
    `Provide a concise counterpoint to the message's viewpoint:`,
    `Offer a surprising twist on the message's underlying theme:`,
    `Generate a brief thought experiment related to the message's concept:`,
    `Offer an alternative perspective on the topic of the message:`,
  ];
  const disclaimer = `This message is for informational purposes only and does not promote violence,
  hate speech, or illegal activities.`;
  async function fetchGenAIResponse(): Promise<string> {
    try {
      const userRoleContent: Content = { role: 'user', parts: [{ text: userRequest }] };
      const history: Content[] = await readChatRoleFromDatabase({ limit: maxHistoryLength });

      const chat = genAImodel.startChat({
        history,
        safetySettings,
      });

      const request = !retryCount
        ? userRequest
        : `${disclaimer} ${retryRequestDisclaimer[retryCount]} ${userRequest} \n Reply in ${config.LANGUAGE}`;

      retryCount += 1;
      const result = await chat.sendMessage(request);

      const { response } = result;
      let responseText = response.text();

      if (!responseText) responseText = translations['botHasNoIdea'];

      await insertToMessages(userRoleContent);
      await insertToMessages({ role: 'model', parts: [{ text: responseText }] });

      return responseText;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  try {
    const responseText = await retry(fetchGenAIResponse, retryRequestDisclaimer.length);
    const formatedText = replaceDoubleSpaces(responseText);
    return formatedText;
  } catch (error: any) {
    return ErrorHandler.handleError(error);
  }
}

export async function generateMultipleResponses(userRequests: string[]): Promise<string[]> {
  return Promise.all(
    userRequests.map(async (chunk) => generateGenAIResponse(`${recapTextRequest} ${chunk}`)),
  );
}

export async function combineResponses(responses: string[]): Promise<string> {
  const combinedResponseArray = responses.join(' ^^^ ');
  const combinedResponse = await generateGenAIResponse(
    `Combine responses separated with ' ^^^ ' into one: ${combinedResponseArray}. Do not include separator in combined response. Do not duplicate topics.`,
  );
  return combinedResponse;
}

export async function returnCombinedAnswerFromMultipleResponses(chunks: string[]): Promise<string> {
  const googleResponses = await generateMultipleResponses(chunks);
  const answer = await combineResponses(googleResponses);
  return answer;
}
