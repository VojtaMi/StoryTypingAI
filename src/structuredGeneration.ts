export interface GenerationSpec<T> {
	shape: unknown;
	instructions: string;
	example?: unknown;
	parse(value: unknown): T;
}

/**
 * Carves `word` out of `sentence`, returning the text around it and the surface
 * form actually matched (`Ella` for the term `ella`). Callers that render the
 * word back into the sentence need `match`, not a re-derivation from the offsets.
 *
 * `word` may be a single word or a multi-word phrase (`piensa en`): it is
 * matched as a run of consecutive whole tokens, so `en` never matches inside
 * `entra` and the gap covers the phrase exactly as it appears in the
 * sentence. Callers that need a length limit enforce it themselves.
 */
export function splitOnWord(
	sentence: string,
	word: string,
	errorMessage = "Generated sentence does not contain the answer word.",
): { before: string; match: string; after: string } {
	const tokenRegex = /\p{L}+/gu;
	const targetTokens = [...word.toLowerCase().matchAll(tokenRegex)].map(
		(token) => token[0],
	);
	if (targetTokens.length === 0) throw new Error(errorMessage);
	const sentenceTokens = [...sentence.matchAll(tokenRegex)];
	for (let i = 0; i + targetTokens.length <= sentenceTokens.length; i++) {
		const run = targetTokens.every(
			(token, j) => sentenceTokens[i + j][0].toLowerCase() === token,
		);
		if (!run) continue;
		const first = sentenceTokens[i];
		const last = sentenceTokens[i + targetTokens.length - 1];
		const start = first.index;
		const end = last.index + last[0].length;
		return {
			before: sentence.slice(0, start),
			match: sentence.slice(start, end),
			after: sentence.slice(end),
		};
	}
	throw new Error(errorMessage);
}

/** Counts whole-word tokens, used to bound how much of a sentence a gap may cover. */
export function countWords(text: string): number {
	return [...text.matchAll(/\p{L}+/gu)].length;
}

export function parseChoices(
	value: unknown,
	answer: string,
	min: number,
	max: number,
	errorMessage = "Generated choices do not include the answer.",
	errorPrefix = "Generated JSON",
): string[] {
	if (!Array.isArray(value))
		throw new Error(`${errorPrefix} choices are invalid.`);
	const choices = value.map((choice) =>
		requiredString(choice, "choice", errorPrefix),
	);
	if (
		choices.length < min ||
		choices.length > max ||
		!choices.includes(answer)
	) {
		throw new Error(errorMessage);
	}
	return choices;
}

export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function requiredString(
	value: unknown,
	label: string,
	errorPrefix = "Generated JSON",
): string {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(`${errorPrefix} is missing ${label}.`);
	}
	return value.trim();
}

export function slugify(value: string, fallback: string): string {
	const slug = value
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
	return slug || fallback;
}
