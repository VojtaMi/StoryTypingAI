import type { Genre, GenreId } from "./genres";
import {
	DEFAULT_TEXT_MODEL,
	STORY_SEGMENT_MAX_TOKENS,
	type TextModelId,
} from "./models";
import type { NarrationVoiceId } from "./narrationVoice";
import {
	type ChatMessage,
	type Complete,
	generateIntro,
	generateTitle,
	openingMessages,
} from "./story";
import { prepareStoryContext, type StoryMemory } from "./story_memory";
import type { StoryOpeningAudio } from "./storyAudio";
import type { StoryBackgroundImage } from "./storyBackground";

export type { ChatMessage, StoryMemory };

export type EsperantoTutorChatMessage = {
	role: "user" | "assistant";
	content: string;
};

interface EsperantoTutorRequest {
	segments: Array<{ author: "ai" | "user"; text: string }>;
	currentTarget: string | null;
	backgroundIntro?: string;
	conversation: EsperantoTutorChatMessage[];
	question: string;
	model?: TextModelId;
}

type StreamEvent =
	| { type: "chunk"; text?: string }
	| { type: "done"; text?: string }
	| { type: "error"; error?: string };

const AI_CONTINUE_PROMPT =
	"Continue the story from here. Keep the same style, tension, and perspective.";

async function complete(
	messages: ChatMessage[],
	model: TextModelId,
	maxTokens = STORY_SEGMENT_MAX_TOKENS,
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
	maxTokens = STORY_SEGMENT_MAX_TOKENS,
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
		const event = JSON.parse(line) as StreamEvent;

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

/** Binds the HTTP transport to a model, producing a generic completion function for the story domain. */
function httpCompleter(model: TextModelId): Complete {
	return (messages, maxTokens) => complete(messages, model, maxTokens);
}

/** Begins a new story for the given genre. Returns the opening and the seeded history. */
export async function startStory(
	genre: Genre,
	model: TextModelId = DEFAULT_TEXT_MODEL,
): Promise<{ text: string; messages: ChatMessage[] }> {
	const messages = openingMessages(genre);
	const text = await complete(messages, model);
	messages.push({ role: "assistant", content: text });
	return { text, messages };
}

export async function continueStoryStream(
	history: ChatMessage[],
	userText: string,
	onChunk: (chunk: string) => void,
	model: TextModelId = DEFAULT_TEXT_MODEL,
	memory?: StoryMemory,
): Promise<{
	text: string;
	messages: ChatMessage[];
	memory?: StoryMemory;
}> {
	const messages: ChatMessage[] = [
		...history,
		{ role: "user", content: userText },
	];
	const context = await prepareStoryContext(
		messages,
		memory,
		httpCompleter(model),
	);
	const text = await completeStream(context.messages, model, onChunk);
	messages.push({ role: "assistant", content: text });
	return { text, messages, memory: context.memory };
}

export async function autoContinueStoryStream(
	history: ChatMessage[],
	onChunk: (chunk: string) => void,
	model: TextModelId = DEFAULT_TEXT_MODEL,
	memory?: StoryMemory,
): Promise<{
	text: string;
	messages: ChatMessage[];
	memory?: StoryMemory;
}> {
	return continueStoryStream(
		history,
		AI_CONTINUE_PROMPT,
		onChunk,
		model,
		memory,
	);
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

export async function generateOpeningAudio(
	text: string,
	storyId: string,
	narrationVoice: NarrationVoiceId,
): Promise<StoryOpeningAudio> {
	const res = await fetch("/api/ai/opening-audio", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ text, storyId, narrationVoice }),
	});
	if (!res.ok) throw new Error(`Opening audio request failed: ${res.status}`);
	return res.json() as Promise<StoryOpeningAudio>;
}

/** Narrates a story segment, returning the spoken audio as an MP3 blob. */
export async function speakStorySegment(
	text: string,
	options: { instructions?: string } = {},
): Promise<Blob> {
	const res = await fetch("/api/ai/speak", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ text, ...options }),
	});
	if (!res.ok) throw new Error(`Narration request failed: ${res.status}`);
	return res.blob();
}

/** Fetches a stable audio URL for a lesson text, generating and caching it server-side on first call. */
export async function fetchLessonAudioUrl(
	lessonId: string,
	text: string,
	instructions?: string,
): Promise<string> {
	const res = await fetch("/api/lesson-audio", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ lessonId, text, instructions }),
	});
	if (!res.ok) throw new Error(`Lesson audio request failed: ${res.status}`);
	const body = (await res.json()) as { url: string };
	return body.url;
}

/** Generates a 1-2 sentence second-person intro describing who the player is and what brought them here. */
export async function generateStoryIntro(
	genreLabel: string,
	openingText: string,
	model: TextModelId = DEFAULT_TEXT_MODEL,
): Promise<string> {
	return generateIntro(httpCompleter(model), genreLabel, openingText);
}

export async function askEsperantoTutor({
	segments,
	currentTarget,
	backgroundIntro,
	conversation,
	question,
	model = DEFAULT_TEXT_MODEL,
}: EsperantoTutorRequest): Promise<string> {
	const storyContext = [
		backgroundIntro ? `Player context: ${backgroundIntro}` : "",
		segments.length > 0
			? `Completed story segments:\n${segments
					.map((segment) =>
						segment.author === "ai"
							? `Story text: ${segment.text}`
							: `Learner continuation: ${segment.text}`,
					)
					.join("\n\n")}`
			: "",
		currentTarget ? `Current typing passage:\n${currentTarget}` : "",
	]
		.filter(Boolean)
		.join("\n\n")
		.slice(-6000);

	const messages: ChatMessage[] = [
		{
			role: "system",
			content:
				"You are Esperanto Bot, a friendly tutor inside an Esperanto story typing exercise. " +
				"Explain Esperanto clearly and practically: vocabulary, roots, affixes, grammar, pronunciation, and why sentences mean what they mean. " +
				"Use the provided story context when it helps. Do not continue or rewrite the story unless the learner asks for that. " +
				"If the learner asks for an exercise answer, prefer a helpful hint and explanation before giving the full answer. " +
				"Reply in the language the learner uses for their latest message. If their message is mixed or ambiguous, reply in English. " +
				"Use simple Esperanto when replying in Esperanto. Keep answers concise, warm, and easy for a beginner to act on. " +
				"Default to 2-5 short sentences. Use plain text suitable for a small chat panel. " +
				"Do not use Markdown tables, headings, horizontal rules, or long lists. If the learner explicitly asks for more detail, you may give a longer answer, but keep the formatting simple.",
		},
		{
			role: "user",
			content: `Story context for this tutoring session:\n${
				storyContext || "No story text is available yet."
			}`,
		},
		...conversation.map((message) => ({
			role: message.role,
			content: message.content,
		})),
		{ role: "user", content: question },
	];

	return complete(messages, model, 520);
}

/** Creates a short title for a saved story without changing the story history. */
export async function titleStory(
	history: ChatMessage[],
	model: TextModelId = DEFAULT_TEXT_MODEL,
): Promise<string> {
	const storyText = history
		.filter((message) => message.role === "assistant")
		.map((message) => message.content)
		.join("\n\n")
		.slice(-3000);

	return generateTitle(httpCompleter(model), storyText);
}
