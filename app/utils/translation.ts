import { readAndParseJson } from '@app/utils/helper';

export type Translations = Record<string, string>;

let translationsCache: Translations;

export async function initializeTranslations(lang: string): Promise<Translations> {
	if (!translationsCache) {
		const filePath = `./app/lang/${lang}.json`;
		const translations = await readAndParseJson(filePath);
		translationsCache = translations as Translations;
	}
	return translationsCache;
}

export function getTranslations(): Translations {
	if (!translationsCache) {
		throw new Error('Translations have not been initialized. Call initializeTranslations first.');
	}
	return translationsCache;
}
const getLanguageCode = (language: string) => language.toLowerCase().slice(0, 2);

try {
	const language = Bun.env.LANGUAGE;
	if (!language) throw Error('No LANGUAGE in env found.');
	const languageCode = getLanguageCode(language);

	await initializeTranslations(languageCode);
} catch (error) {
	throw Error(`Failed to initialize translations! ${error}`);
}

export default translationsCache as Translations;
