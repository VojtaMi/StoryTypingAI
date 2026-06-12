import OpenAI from "openai";
import type { Genre } from "./genres";

// SECURITY: This calls OpenAI directly from the browser, so VITE_OPENAI_API_KEY
// is bundled into the shipped JS and visible to anyone loading the page.
// Fine for local practice only — DO NOT deploy publicly. To deploy, move these
// calls behind a small backend proxy that holds the key server-side.
const client = new OpenAI({
	apiKey: import.meta.env.VITE_OPENAI_API_KEY,
	dangerouslyAllowBrowser: true,
});

// Swappable: gpt-4o-mini is fast and cheap; bump to a larger model for richer prose.
const MODEL = "gpt-4o-mini";

export type ChatMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

// Replace typographic characters that keyboards can't easily type with their
// plain ASCII equivalents, so the typing exercise stays typeable.
function normalize(text: string): string {
	return text
		.replace(/[‘’‚‛]/g, "'") // curly single quotes → '
		.replace(/[“”„‟]/g, '"') // curly double quotes → "
		.replace(/–/g, "-") // en dash → -
		.replace(/—/g, "--") // em dash → --
		.replace(/…/g, "..."); // ellipsis → ...
}

async function complete(messages: ChatMessage[]): Promise<string> {
	const response = await client.chat.completions.create({
		model: MODEL,
		max_tokens: 150,
		messages,
	});
	const text = response.choices[0]?.message?.content?.trim();
	if (!text) throw new Error("The AI returned an empty response.");
	return normalize(text);
}

/** Begins a new story for the given genre. Returns the opening and the seeded history. */
export async function startStory(
	genre: Genre,
): Promise<{ text: string; messages: ChatMessage[] }> {
	const messages: ChatMessage[] = [
		{ role: "system", content: genre.systemPrompt },
		{ role: "user", content: "Begin the story." },
	];
	const text = await complete(messages);
	messages.push({ role: "assistant", content: text });
	return { text, messages };
}

/** Continues the story with the user's own contribution. Returns the AI's next segment. */
export async function continueStory(
	history: ChatMessage[],
	userText: string,
): Promise<{ text: string; messages: ChatMessage[] }> {
	const messages: ChatMessage[] = [
		...history,
		{ role: "user", content: userText },
	];
	const text = await complete(messages);
	messages.push({ role: "assistant", content: text });
	return { text, messages };
}
