import { config } from '@app/config';
import { readAndParseJson } from '@app/utils/helper';

export type Translations = Record<string, string>;

let translationsCache: Translations;

export async function initializeTranslations(lang: string): Promise<void> {
  if (!translationsCache) {
    const filePath = `./app/lang/${lang}.json`;
    const translations = await readAndParseJson(filePath);
    translationsCache = translations as Translations;
  }
}

export function getTranslations(): Translations {
  if (!translationsCache) {
    throw new Error('Translations have not been initialized. Call initializeTranslations first.');
  }
  return translationsCache;
}
const getLanguageCode = (language: string) => language.toLowerCase().slice(0, 2);
await initializeTranslations(getLanguageCode(config.LANGUAGE));

export default translationsCache as Translations;
