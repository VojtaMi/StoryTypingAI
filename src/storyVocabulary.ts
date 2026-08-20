import type { LanguageId } from "./languages";

const STORY_WORD_PATTERN = /\p{L}+(?:[-’']\p{L}+)*/gu;

/** Returns unique normalized words, excluding known proper names. */
export function storyWords(
	parts: string[],
	excludedWords: string[] = [],
	genreId: LanguageId = "esperanto",
): string[] {
	const excluded = new Set(
		excludedWords.flatMap((word) => {
			const normalized = word.toLowerCase();
			return genreId === "esperanto" && !normalized.endsWith("n")
				? [normalized, `${normalized}n`, `${normalized}-n`]
				: [normalized];
		}),
	);
	return [
		...new Set(
			parts
				.flatMap((part) => part.match(STORY_WORD_PATTERN) ?? [])
				.map((word) => word.toLowerCase())
				.filter((word) => !excluded.has(word)),
		),
	];
}

export function isStoryName(
	word: string,
	names: string[],
	genreId: LanguageId = "esperanto",
): boolean {
	const normalized = word.toLowerCase();
	return names.some((name) => {
		const normalizedName = name.toLowerCase();
		return genreId === "esperanto"
			? normalized === normalizedName ||
					normalized === `${normalizedName}n` ||
					normalized === `${normalizedName}-n`
			: normalized === normalizedName;
	});
}
