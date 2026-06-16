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

async function completeStream(
	messages: ChatMessage[],
	model: TextModelId,
	onChunk: (chunk: string) => void,
	maxTokens = 150,
): Promise<string> {
	const res = await fetch("/api/ai/complete-stream", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ messages, maxTokens, model }),
	});
	if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
	if (!res.body) throw new Error("The AI did not return a response stream.");

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let finalText = "";

	function readLine(line: string) {
		if (!line.trim()) return;
		const event = JSON.parse(line) as
			| { type: "chunk"; text?: string }
			| { type: "done"; text?: string }
			| { type: "error"; error?: string };

		if (event.type === "chunk") {
			if (event.text) onChunk(event.text);
			return;
		}

		if (event.type === "done") {
			finalText = event.text ?? "";
			return;
		}

		throw new Error(event.error || "The AI stream failed.");
	}

	while (true) {
		const { value, done } = await reader.read();
		buffer += decoder.decode(value, { stream: !done });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) readLine(line);
		if (done) break;
	}

	if (buffer) readLine(buffer);
	if (!finalText) throw new Error("The AI returned an empty response.");
	return finalText;
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

export async function continueStoryStream(
	history: ChatMessage[],
	userText: string,
	onChunk: (chunk: string) => void,
	model: TextModelId = DEFAULT_TEXT_MODEL,
): Promise<{ text: string; messages: ChatMessage[] }> {
	const messages: ChatMessage[] = [
		...history,
		{ role: "user", content: userText },
	];
	const text = await completeStream(messages, model, onChunk);
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
	storyId: string,
): Promise<StoryBackgroundImage> {
	const res = await fetch("/api/ai/background-image", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ genreId, messages, storyId }),
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
