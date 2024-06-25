import { config } from '../config';
import { readAndParseJson } from './helper';

export type Translations = Record<string, string>;

let translationsCache: Translations | undefined;

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

await initializeTranslations(config.LANGUAGE);

export default translationsCache as Translations;
