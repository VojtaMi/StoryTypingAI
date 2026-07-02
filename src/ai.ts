import type { Genre, GenreId } from "./genres";
import type { LearnerContext } from "./learnerContext";
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
	generateReadingFrame,
	generateTitle,
	openingMessages,
	type ReadingStoryFrame,
	readingPartMessages,
} from "./story";
import { prepareStoryContext, type StoryMemory } from "./story_memory";
import type { StoryOpeningAudio } from "./storyAudio";
import type { StoryBackgroundImage } from "./storyBackground";

export type { ChatMessage, ReadingStoryFrame, StoryMemory };

const READING_STORY_PART_MAX_TOKENS = 700;

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

let learnerContextPromise: Promise<LearnerContext> | null = null;

/** Drops the cached learner profile so the next reading story refetches it. */
export function invalidateLearnerProfile() {
	learnerContextPromise = null;
}

/**
 * Fetches the durable learner handout that adapts reading stories to what the
 * learner knows. Cached for the session; refreshed after the tutor chat refines
 * it. Returns "" on any failure so story generation still works.
 */
export async function fetchLearnerProfile(): Promise<string> {
	const context = await fetchLearnerContext();
	return context.languageProfile;
}

async function fetchLearnerContext(): Promise<LearnerContext> {
	if (!learnerContextPromise) {
		learnerContextPromise = (async () => {
			const res = await fetch("/api/learner-profile");
			if (!res.ok) throw new Error(`Profile request failed: ${res.status}`);
			const body = (await res.json()) as {
				profile?: string;
				languageProfile?: string;
				preferences?: string;
				storyMemory?: string;
			};
			return {
				languageProfile: body.languageProfile ?? body.profile ?? "",
				preferences: body.preferences ?? "",
				storyMemory: body.storyMemory ?? "",
			};
		})();
	}

	try {
		return await learnerContextPromise;
	} catch {
		learnerContextPromise = null;
		return { languageProfile: "", preferences: "", storyMemory: "" };
	}
}

/**
 * Folds a tutor-chat transcript into the learner handout. Fire-and-forget: it
 * must never disrupt closing the chat, so all failures are swallowed.
 */
export async function refineLearnerProfileFromChat(
	messages: EsperantoTutorChatMessage[],
): Promise<void> {
	if (messages.length === 0) return;
	try {
		invalidateLearnerProfile();
		const res = await fetch("/api/learner-profile/refine", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages }),
		});
		if (res.ok) invalidateLearnerProfile();
	} catch {
		// Fire-and-forget: the handout simply stays as it was.
	}
}

export interface StoryFinishFeedback {
	storySummary?: string;
	feedback?: string;
}

/**
 * Folds evidence from a just-finished reading story (word lookups since the
 * last refine, the story's premise/character/setting, and optional learner
 * difficulty feedback) into the learner handout. Fire-and-forget: it must
 * never disrupt the reading flow, so all failures are swallowed.
 */
export async function refineLearnerProfileFromStory(
	evidence: StoryFinishFeedback,
): Promise<void> {
	if (!evidence.storySummary?.trim() && !evidence.feedback?.trim()) return;
	try {
		invalidateLearnerProfile();
		const res = await fetch("/api/learner-profile/refine-story", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(evidence),
		});
		if (res.ok) invalidateLearnerProfile();
	} catch {
		// Fire-and-forget: the handout simply stays as it was.
	}
}

export async function generateReadingStoryFrame(
	genre: Genre,
	model: TextModelId = DEFAULT_TEXT_MODEL,
): Promise<ReadingStoryFrame> {
	const learnerContext = await fetchLearnerContext();
	return generateReadingFrame(httpCompleter(model), genre, learnerContext);
}

export async function generateReadingStoryPart(
	frame: ReadingStoryFrame,
	partIndex: number,
	previousParts: string[],
	model: TextModelId = DEFAULT_TEXT_MODEL,
): Promise<{
	text: string;
	messages: ChatMessage[];
}> {
	const fallbackContext = await fetchLearnerContext();
	const learnerContext = {
		languageProfile: frame.learnerProfile ?? fallbackContext.languageProfile,
		preferences: frame.learnerPreferences ?? fallbackContext.preferences,
		storyMemory: frame.storyMemory ?? fallbackContext.storyMemory,
	};
	const messages = readingPartMessages(
		frame,
		partIndex,
		previousParts,
		learnerContext,
	);
	const text = await complete(messages, model, READING_STORY_PART_MAX_TOKENS);
	return {
		text,
		messages: [...messages, { role: "assistant", content: text }],
	};
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
	options: { sectionIndex?: number; visualContext?: string } = {},
): Promise<StoryBackgroundImage> {
	const res = await fetch("/api/ai/background-image", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ genreId, messages, storyId, ...options }),
	});
	if (!res.ok) throw new Error(`Image request failed: ${res.status}`);
	return res.json() as Promise<StoryBackgroundImage>;
}

export async function generateOpeningAudio(
	text: string,
	storyId: string,
	narrationVoice: NarrationVoiceId,
	options: { sectionIndex?: number } = {},
): Promise<StoryOpeningAudio> {
	const res = await fetch("/api/ai/opening-audio", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ text, storyId, narrationVoice, ...options }),
	});
	if (!res.ok) throw new Error(`Opening audio request failed: ${res.status}`);
	return res.json() as Promise<StoryOpeningAudio>;
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

export async function translateWords(
	words: string[],
): Promise<Record<string, string>> {
	if (words.length === 0) return {};
	const res = await fetch("/api/ai/translate-words", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ words }),
	});
	if (!res.ok) throw new Error(`Translation request failed: ${res.status}`);
	const body = (await res.json()) as { translations: Record<string, string> };
	return body.translations;
}

export async function getWordAudioUrl(word: string): Promise<string> {
	const res = await fetch("/api/word-audio", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ word }),
	});
	if (!res.ok) throw new Error(`Word audio request failed: ${res.status}`);
	const body = (await res.json()) as { url: string };
	return body.url;
}

export async function logLearnerWordClick(word: string): Promise<void> {
	try {
		await fetch("/api/learner-profile/word-log", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ word }),
		});
	} catch {
		// Learning signals should never interrupt reading.
	}
}

export async function regenerateWordAudioUrl(word: string): Promise<string> {
	const res = await fetch("/api/word-audio/regenerate", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ word }),
	});
	if (!res.ok) throw new Error(`Word audio regenerate failed: ${res.status}`);
	const body = (await res.json()) as { url: string };
	return body.url;
}

export async function regenerateWordTranslation(
	word: string,
): Promise<string | null> {
	const res = await fetch("/api/ai/translate-words/regenerate", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ word }),
	});
	if (!res.ok) throw new Error(`Regenerate request failed: ${res.status}`);
	const body = (await res.json()) as { translation: string | null };
	return body.translation;
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
