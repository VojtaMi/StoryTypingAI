import type { Genre, GenreId } from "./genres";
import { DEFAULT_TEXT_MODEL, type TextModelId } from "./models";
import type { StoryBackgroundImage } from "./storyBackground";

export type ChatMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

async function complete(
	messages: ChatMessage[],
	model: TextModelId,
	maxTokens = 150,
): Promise<string> {
	const res = await fetch("/api/ai/complete", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ messages, maxTokens, model }),
	});
	if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
	const { text } = (await res.json()) as { text?: string };
	if (!text) throw new Error("The AI returned an empty response.");
	return text;
}

/** Begins a new story for the given genre. Returns the opening and the seeded history. */
export async function startStory(
	genre: Genre,
	model: TextModelId = DEFAULT_TEXT_MODEL,
): Promise<{ text: string; messages: ChatMessage[] }> {
	const messages: ChatMessage[] = [
		{ role: "system", content: genre.systemPrompt },
		{ role: "user", content: "Begin the story." },
	];
	const text = await complete(messages, model);
	messages.push({ role: "assistant", content: text });
	return { text, messages };
}

/** Continues the story with the user's own contribution. Returns the AI's next segment. */
export async function continueStory(
	history: ChatMessage[],
	userText: string,
	model: TextModelId = DEFAULT_TEXT_MODEL,
): Promise<{ text: string; messages: ChatMessage[] }> {
	const messages: ChatMessage[] = [
		...history,
		{ role: "user", content: userText },
	];
	const text = await complete(messages, model);
	messages.push({ role: "assistant", content: text });
	return { text, messages };
}

export async function generateStoryBackgroundImage(
	genreId: GenreId,
	messages: ChatMessage[],
): Promise<StoryBackgroundImage> {
	const res = await fetch("/api/ai/background-image", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ genreId, messages }),
	});
	if (!res.ok) throw new Error(`Image request failed: ${res.status}`);
	return res.json() as Promise<StoryBackgroundImage>;
}

/** Generates a 1-2 sentence second-person intro describing who the player is and what brought them here. */
export async function generateStoryIntro(
	genreLabel: string,
	openingText: string,
	model: TextModelId = DEFAULT_TEXT_MODEL,
): Promise<string> {
	return complete(
		[
			{
				role: "system",
				content:
					"Write a 1-2 sentence second-person character introduction for an interactive story. " +
					"State concretely who the player character is and what brought them to this place. " +
					"Start with 'You'. Output only the introduction — no quotes, no headings.",
			},
			{
				role: "user",
				content: `${genreLabel} story opening:\n${openingText}`,
			},
		],
		model,
		100,
	);
}

/** Creates a short title for a saved story without changing the story history. */
export async function titleStory(
	history: ChatMessage[],
	model: TextModelId = DEFAULT_TEXT_MODEL,
): Promise<string> {
	const storyText = history
		.filter((message) => message.role !== "system")
		.map((message) => message.content)
		.join("\n\n")
		.slice(-3000);

	const text = await complete(
		[
			{
				role: "system",
				content:
					"Create a concise title for this interactive story. Return only the title, with no quotes or punctuation at the end.",
			},
			{ role: "user", content: storyText },
		],
		model,
	);

	return text.replace(/^["']|["'.!?]$/g, "").trim();
}
