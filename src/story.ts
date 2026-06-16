import type { Genre } from "./genres";

export type ChatMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

/**
 * Runs one non-streaming completion. Each call site supplies its own transport:
 * an HTTP fetch from the browser, an in-process call from the CLI.
 */
export type Complete = (
	messages: ChatMessage[],
	maxTokens: number,
) => Promise<string>;

const TITLE_PROMPT =
	"Create a concise title for this story excerpt. Do not continue the story. Return exactly one title line, 2-6 words, with no quotes, punctuation, headings, or story prose.";

const INTRO_PROMPT =
	"Write a 1-2 sentence second-person character introduction for an interactive story. " +
	"State concretely who the player character is and what brought them to this place. " +
	"Start with 'You'. Output only the introduction — no quotes, no headings.";

const TITLE_MAX_TOKENS = 120;
const INTRO_MAX_TOKENS = 180;

/** Messages that begin a new story. Pass a seed to nudge the opening toward a specific element. */
export function openingMessages(genre: Genre, seed?: string): ChatMessage[] {
	return [
		{ role: "system", content: genre.systemPrompt },
		{
			role: "user",
			content: seed
				? `Begin the story. Seed element: ${seed}.`
				: "Begin the story.",
		},
	];
}

/** Creates a concise title for a story excerpt. */
export async function generateTitle(
	complete: Complete,
	storyText: string,
): Promise<string> {
	const text = await complete(
		[
			{ role: "system", content: TITLE_PROMPT },
			{ role: "user", content: storyText },
		],
		TITLE_MAX_TOKENS,
	);
	return text.replace(/^["']|["'.!?]$/g, "").trim();
}

/** Generates a 1-2 sentence second-person intro describing who the player is and what brought them here. */
export async function generateIntro(
	complete: Complete,
	genreLabel: string,
	openingText: string,
): Promise<string> {
	return complete(
		[
			{ role: "system", content: INTRO_PROMPT },
			{ role: "user", content: `${genreLabel} story opening:\n${openingText}` },
		],
		INTRO_MAX_TOKENS,
	);
}
