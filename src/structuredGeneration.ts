export interface GenerationSpec<T> {
	shape: string;
	instructions: string;
	parse(value: unknown): T;
}

export function splitOnWord(
	sentence: string,
	word: string,
	errorMessage = "Generated sentence does not contain the answer word.",
): { before: string; after: string } {
	const target = word.toLowerCase();
	const tokenRegex = /\p{L}+/gu;
	for (const match of sentence.matchAll(tokenRegex)) {
		if (match[0].toLowerCase() === target) {
			return {
				before: sentence.slice(0, match.index),
				after: sentence.slice(match.index + match[0].length),
			};
		}
	}
	throw new Error(errorMessage);
}

export function parseChoices(
	value: unknown,
	answer: string,
	min: number,
	max: number,
	errorMessage = "Generated choices do not include the answer.",
): string[] {
	if (!Array.isArray(value)) throw new Error("Generated choices are invalid.");
	const choices = value.map((choice) => requiredString(choice, "choice"));
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
