import type { Genre } from "./genres";

export type ChatMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

async function complete(
	messages: ChatMessage[],
	maxTokens = 150,
): Promise<string> {
	const res = await fetch("/api/ai/complete", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ messages, maxTokens }),
	});
	if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
	const { text } = (await res.json()) as { text?: string };
	if (!text) throw new Error("The AI returned an empty response.");
	return text;
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

/** Creates a short title for a saved story without changing the story history. */
export async function titleStory(history: ChatMessage[]): Promise<string> {
	const storyText = history
		.filter((message) => message.role !== "system")
		.map((message) => message.content)
		.join("\n\n")
		.slice(-3000);

	const text = await complete([
		{
			role: "system",
			content:
				"Create a concise title for this interactive story. Return only the title, with no quotes or punctuation at the end.",
		},
		{ role: "user", content: storyText },
	]);

	return text.replace(/^["']|["'.!?]$/g, "").trim();
}
