import {
	DEFAULT_LANGUAGE,
	getLanguage,
	isLanguageId,
	type LanguageId,
	languageFaviconUrl,
} from "./languages";

const LAST_LANGUAGE_KEY = "last-learning-language";

export function readSelectedLanguage(): LanguageId {
	const remembered = localStorage.getItem(LAST_LANGUAGE_KEY);
	return isLanguageId(remembered) ? remembered : DEFAULT_LANGUAGE.id;
}

export function selectLanguage(languageId: LanguageId): void {
	localStorage.setItem(LAST_LANGUAGE_KEY, languageId);
}

export function syncLanguageDocument(languageId: LanguageId): void {
	const language = getLanguage(languageId);
	document.title = `${language.label} through tiny stories`;
	const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
	if (favicon) favicon.href = languageFaviconUrl(language);
}
