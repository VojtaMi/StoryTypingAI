import { DEFAULT_GENRE, type GenreId, getGenre, isGenreId } from "./genres";

const LANGUAGE_QUERY_KEY = "language";
const LAST_LANGUAGE_KEY = "last-learning-language";

export function readSelectedLanguage(): GenreId {
	const url = new URL(window.location.href);
	const fromUrl = url.searchParams.get(LANGUAGE_QUERY_KEY);
	if (isGenreId(fromUrl)) return fromUrl;
	const remembered = localStorage.getItem(LAST_LANGUAGE_KEY);
	return isGenreId(remembered) ? remembered : DEFAULT_GENRE.id;
}

export function selectLanguage(languageId: GenreId): void {
	localStorage.setItem(LAST_LANGUAGE_KEY, languageId);
	const url = new URL(window.location.href);
	url.pathname = "/";
	url.searchParams.set(LANGUAGE_QUERY_KEY, languageId);
	window.history.pushState(null, "", url);
}

export function syncLanguageDocument(languageId: GenreId): void {
	const language = getGenre(languageId);
	document.title = `${language.label} through tiny stories`;
	const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
	if (favicon) favicon.href = language.faviconUrl;
}
