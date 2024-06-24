import { Content } from '@google/generative-ai';
import { config, featureFlags, genAImodel, maxHistoryLength, recapTextRequest, safetySettings } from '../../config';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { insertToMessages, readChatRoleFromDatabase } from '../../helper';

export async function generateGenAIResponse(userRequest: string): Promise<string> {
  try {
    const userRoleContent: Content = { role: 'user', parts: [{ text: userRequest }] };
    const history: Content[] = await readChatRoleFromDatabase({ limit: maxHistoryLength });

    const chat = genAImodel.startChat({
      history,
      safetySettings,
    });

    const result = await chat.sendMessage(userRequest);
    const { response } = result;

    let responseText = response.text();

    if (!responseText) responseText = 'Бля я хуй знает дядя.';

    await insertToMessages(userRoleContent);
    await insertToMessages({ role: 'model', parts: [{ text: responseText }] });

    return responseText;
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
