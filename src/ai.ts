import type { Genre, GenreId } from "./genres";
import type { LearnerContext } from "./learnerContext";
import type { LearnerPreferences } from "./learnerState";
import { DEFAULT_LEARNER_CONTEXT, parseLearnerContext } from "./learnerState";
import {
	buildLessonPrompt,
	DEFAULT_LESSON_GENERATION_SELECTION,
	getLessonBricks,
	type LessonGenerationSelection,
	parseGeneratedLesson,
} from "./lessons/lessonGeneration";
import type { Lesson, LessonLevel } from "./lessons/types";
import {
	DEFAULT_TEXT_MODEL,
	EXERCISE_MODEL,
	STORY_SEGMENT_MAX_TOKENS,
	type TextModelId,
	type TextReasoningEffort,
} from "./models";
import type { NarrationVoiceId } from "./narrationVoice";
import {
	type ChatMessage,
	type Complete,
	generateIntro,
	generateReadingStory as generateReadingStoryText,
	generateTitle,
	openingMessages,
	type ReadingStory,
	type ReadingStoryPart,
} from "./story";
import { prepareStoryContext, type StoryMemory } from "./story_memory";
import type { StoryOpeningAudio } from "./storyAudio";
import type { StoryBackgroundImage } from "./storyBackground";
import {
	buildStoryRecapPrompt,
	parseStoryRecapLesson,
	type StoryRecapExerciseResult,
	type StoryRecapLesson,
} from "./storyRecap";
import { normalizeStoryText } from "./storyText";
import { slugify } from "./structuredGeneration";
import type { TtsModelId } from "./ttsModel";

export type { ChatMessage, ReadingStory, ReadingStoryPart, StoryMemory };

const STORY_RECAP_MAX_TOKENS = 900;
const LESSON_GENERATION_MAX_TOKENS = 1600;

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

/**
 * POSTs `body` as JSON to an app endpoint. `label` names the operation in the
 * thrown error, which reaches the learner as a message (e.g. "Translation
 * request failed: 503").
 */
async function post(
	url: string,
	body: unknown,
	label: string,
): Promise<Response> {
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		let detail = `${res.status}`;
		try {
			const body = (await res.json()) as { error?: unknown };
			if (typeof body.error === "string" && body.error.trim()) {
				detail = body.error;
			}
		} catch {
			// Keep the status when the server did not return JSON.
		}
		throw new Error(`${label} failed: ${detail}`);
	}
	return res;
}

/** {@link post}, then parses the JSON reply. */
async function postJson<T>(
	url: string,
	body: unknown,
	label: string,
): Promise<T> {
	const res = await post(url, body, label);
	return (await res.json()) as T;
}

async function complete(
	messages: ChatMessage[],
	model: TextModelId,
	maxTokens = STORY_SEGMENT_MAX_TOKENS,
	responseFormat: "text" | "json" = "text",
	reasoningEffort?: TextReasoningEffort,
): Promise<string> {
	const { text } = await postJson<{ text?: string }>(
		"/api/ai/complete",
		{ messages, maxTokens, model, responseFormat, reasoningEffort },
		"AI request",
	);
	if (!text) throw new Error("The AI returned an empty response.");
	return text;
}

async function completeStream(
	messages: ChatMessage[],
	model: TextModelId,
	onChunk: (chunk: string) => void,
	maxTokens = STORY_SEGMENT_MAX_TOKENS,
): Promise<string> {
	const res = await post(
		"/api/ai/complete-stream",
		{ messages, maxTokens, model },
		"AI request",
	);
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

/** Structured output must reach its parser without prose normalization. */
function structuredHttpCompleter(model: TextModelId): Complete {
	return (messages, maxTokens, options) =>
		complete(messages, model, maxTokens, "json", options?.reasoningEffort);
}

/** Begins a new story for the given genre. Returns the opening and the seeded history. */
export async function startStory(
	genre: Genre,
	model: TextModelId = DEFAULT_TEXT_MODEL,
): Promise<{ text: string; messages: ChatMessage[] }> {
	const messages = openingMessages(genre);
	const text = normalizeStoryText(await complete(messages, model));
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
	return JSON.stringify(context.languageProfile);
}

async function fetchLearnerContext(): Promise<LearnerContext> {
	if (!learnerContextPromise) {
		learnerContextPromise = (async () => {
			const res = await fetch("/api/learner-profile");
			if (!res.ok) throw new Error(`Profile request failed: ${res.status}`);
			const context = parseLearnerContext(await res.json());
			if (!context) throw new Error("Profile response has an invalid shape.");
			return context;
		})();
	}

	try {
		return await learnerContextPromise;
	} catch {
		learnerContextPromise = null;
		return structuredClone(DEFAULT_LEARNER_CONTEXT);
	}
}

export async function fetchLearnerPreferences(): Promise<LearnerPreferences> {
	return (await fetchLearnerContext()).preferences;
}

export async function updateLearnerPreferences(
	preferences: Pick<LearnerPreferences, "prefer" | "avoid">,
): Promise<LearnerPreferences> {
	const response = await fetch("/api/learner-profile/preferences", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(preferences),
	});
	if (!response.ok) throw new Error(await response.text());
	invalidateLearnerProfile();
	return (await response.json()) as LearnerPreferences;
}

/**
 * Folds evidence into the learner handout. Fire-and-forget: refining must never
 * disrupt the learner's flow, so all failures are swallowed and the handout
 * stays as it was. Invalidates on both sides of the request so a read racing it
 * cannot leave a stale profile cached.
 */
async function refineLearnerProfile(
	endpoint: string,
	evidence: unknown,
): Promise<void> {
	try {
		invalidateLearnerProfile();
		await post(`/api/learner-profile/${endpoint}`, evidence, "Profile refine");
		invalidateLearnerProfile();
	} catch {
		// Fire-and-forget: the handout simply stays as it was.
	}
}

/** Folds a tutor-chat transcript into the learner handout. */
export async function refineLearnerProfileFromChat(
	messages: EsperantoTutorChatMessage[],
): Promise<void> {
	if (messages.length === 0) return;
	return refineLearnerProfile("refine", { messages });
}

export interface StoryFinishEvidence {
	storyId: string;
	storySummary: string;
	learnerQuestions?: string[];
	recapResults: StoryRecapExerciseResult[];
	feedback?: string;
}

/**
 * Baseline finalization for a just-finished reading story: folds the story
 * summary/character/setting, this story's word lookups (aggregated server-side),
 * and the learner's buffered tutor questions into the handout. Idempotent on the
 * server, so calling it more than once for a story is safe.
 */
export async function finalizeReadingStoryEvidence(
	evidence: StoryFinishEvidence,
): Promise<void> {
	return refineLearnerProfile("finalize-story", evidence);
}

/**
 * Generates a whole reading story — metadata, title, and all six Esperanto
 * parts — in one request. This is the only text generation a reading story
 * makes: advancing through it reads `story.parts`, it does not call the AI.
 */
export async function generateReadingStory(
	genre: Genre,
	model: TextModelId = DEFAULT_TEXT_MODEL,
): Promise<ReadingStory> {
	const learnerContext = await fetchLearnerContext();
	return generateReadingStoryText(
		structuredHttpCompleter(model),
		genre,
		learnerContext,
	);
}

interface GenerateStoryRecapLessonInput {
	storyParts: string[];
	languageFocuses: string[];
	wordTranslations: Record<string, string>;
}

export interface GenerateLessonInput {
	level: LessonLevel;
	topic: string;
	targetWords?: string[];
	selection?: Omit<LessonGenerationSelection, "level">;
}

export async function generateStoryRecapLesson(
	input: GenerateStoryRecapLessonInput,
	model: TextModelId = EXERCISE_MODEL,
): Promise<StoryRecapLesson> {
	const learnerProfile = await fetchLearnerProfile();
	const text = await complete(
		[
			{ role: "system", content: buildStoryRecapPrompt() },
			{
				role: "user",
				content: [
					"Finished six-part reading story:",
					input.storyParts
						.map((part, index) => `Part ${index + 1}: ${part}`)
						.join("\n\n"),
					"",
					"Language focuses:",
					input.languageFocuses.join("\n"),
					"",
					"Available word translations:",
					JSON.stringify(input.wordTranslations, null, 2),
					"",
					"Learner profile:",
					learnerProfile || "(none)",
				].join("\n"),
			},
		],
		model,
		STORY_RECAP_MAX_TOKENS,
		"json",
	);
	return parseStoryRecapLesson(text);
}

export async function generateLesson(
	input: GenerateLessonInput,
	model: TextModelId = DEFAULT_TEXT_MODEL,
): Promise<Lesson> {
	const learnerProfile = await fetchLearnerProfile();
	const selection: LessonGenerationSelection = {
		level: input.level,
		body: input.selection?.body ?? DEFAULT_LESSON_GENERATION_SELECTION.body,
		exercises:
			input.selection?.exercises ??
			DEFAULT_LESSON_GENERATION_SELECTION.exercises,
	};
	const bricks = getLessonBricks(selection);
	const text = await complete(
		[
			{ role: "system", content: buildLessonPrompt(bricks) },
			{
				role: "user",
				content: [
					`Topic: ${input.topic}`,
					`Level: ${input.level}`,
					"",
					"Target words:",
					input.targetWords?.length
						? input.targetWords.join(", ")
						: "(choose appropriate beginner words)",
					"",
					"Learner profile:",
					learnerProfile || "(none)",
				].join("\n"),
			},
		],
		model,
		LESSON_GENERATION_MAX_TOKENS,
		"json",
	);
	return parseGeneratedLesson(
		text,
		bricks,
		(title) => `generated-${slugify(title, "lesson")}-${Date.now()}`,
	);
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
	return postJson<StoryBackgroundImage>(
		"/api/ai/background-image",
		{ genreId, messages, storyId, ...options },
		"Image request",
	);
}

export async function generateOpeningAudio(
	text: string,
	storyId: string,
	narrationVoice: NarrationVoiceId,
	options: { sectionIndex?: number; ttsModel?: TtsModelId } = {},
): Promise<StoryOpeningAudio> {
	return postJson<StoryOpeningAudio>(
		"/api/ai/opening-audio",
		{ text, storyId, narrationVoice, ...options },
		"Opening audio request",
	);
}

/** Fetches a stable audio URL for a lesson text, generating and caching it server-side on first call. */
export async function fetchLessonAudioUrl(
	lessonId: string,
	text: string,
	instructions?: string,
): Promise<string> {
	const body = await postJson<{ url: string }>(
		"/api/lesson-audio",
		{ lessonId, text, instructions },
		"Lesson audio request",
	);
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
	const body = await postJson<{ translations: Record<string, string> }>(
		"/api/ai/translate-words",
		{ words },
		"Translation request",
	);
	return body.translations;
}

export async function getWordAudioUrl(word: string): Promise<string> {
	const body = await postJson<{ url: string }>(
		"/api/word-audio",
		{ word },
		"Word audio request",
	);
	return body.url;
}

export async function logLearnerWordClick(
	word: string,
	storyId?: string,
): Promise<void> {
	try {
		await fetch("/api/learner-profile/word-log", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ word, ...(storyId ? { storyId } : {}) }),
		});
	} catch {
		// Learning signals should never interrupt reading.
	}
}

export async function regenerateWordAudioUrl(word: string): Promise<string> {
	const body = await postJson<{ url: string }>(
		"/api/word-audio/regenerate",
		{ word },
		"Word audio regenerate",
	);
	return body.url;
}

export async function regenerateWordTranslation(
	word: string,
): Promise<string | null> {
	const body = await postJson<{ translation: string | null }>(
		"/api/ai/translate-words/regenerate",
		{ word },
		"Regenerate request",
	);
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
