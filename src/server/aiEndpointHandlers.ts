import type { IncomingMessage, ServerResponse } from "node:http";
import type OpenAI from "openai";
import type { ChatMessage } from "../ai";
import { DEFAULT_TEXT_MODEL, STORY_SEGMENT_MAX_TOKENS } from "../models";
import { isNarrationVoiceId } from "../narrationVoice";
import { completeAi, streamAi, translateWords } from "./aiService";
import { readBody, sendJson } from "./http";
import {
	refineLearnerPreferencesFromChat,
	refineLearnerProfile,
	refineLearnerProfileFromStory,
	refineStoryMemoryFromStory,
} from "./learnerProfileService";
import {
	readLearnerContext,
	readLearnerPreferences,
	readLearnerProfile,
	readStoryMemory,
	writeLearnerPreferences,
	writeLearnerProfile,
	writeStoryMemory,
} from "./learnerProfileStore";
import {
	advanceWordLogCursor,
	appendLearnerWordLogEntry,
	readWordLookupsSinceLastRefine,
} from "./learnerWordLogStore";
import { startNdjsonResponse, writeJsonLine } from "./ndjson";
import { createBackgroundImage, findGenre } from "./openingsStore";
import { saveIdPattern } from "./savesStore";
import { createOpeningAudio } from "./storyAudioStore";
import {
	evictWord,
	lookupWords,
	storeTranslations,
} from "./translationCacheStore";
import {
	getOrCreateWordAudio,
	regenerateWordAudio,
	wordFilePattern,
} from "./wordAudioStore";

let learnerProfileRefineQueue: Promise<void> = Promise.resolve();
const learnerWordPattern = /^[a-zA-ZĉĝĥĵŝŭĈĜĤĴŜŬ]+$/u;

export async function handleBackgroundImageRequest(
	req: IncomingMessage,
	res: ServerResponse,
	openai: OpenAI,
) {
	const { genreId, messages, storyId, sectionIndex, visualContext } =
		JSON.parse(await readBody(req));
	const genre = findGenre(genreId);
	if (!genre) {
		sendJson(res, 404, { error: "Genre not found." });
		return;
	}
	if (!storyId || typeof storyId !== "string" || !saveIdPattern.test(storyId)) {
		sendJson(res, 400, { error: "storyId is required." });
		return;
	}
	sendJson(
		res,
		200,
		await createBackgroundImage(
			openai,
			genre,
			storyTextFromMessages(messages),
			storyId,
			{
				sectionIndex: validSectionIndex(sectionIndex),
				visualContext:
					typeof visualContext === "string" ? visualContext : undefined,
			},
		),
	);
}

export async function handleCompleteStreamRequest(
	req: IncomingMessage,
	res: ServerResponse,
	openai: OpenAI,
	anthropicKey: string,
) {
	const {
		messages,
		maxTokens = STORY_SEGMENT_MAX_TOKENS,
		model = DEFAULT_TEXT_MODEL,
	} = JSON.parse(await readBody(req));
	startNdjsonResponse(res);
	const text = await streamAi(
		openai,
		messages,
		maxTokens,
		model,
		anthropicKey,
		(chunk) => writeJsonLine(res, { type: "chunk", text: chunk }),
	);
	writeJsonLine(res, { type: "done", text });
	res.end();
}

export async function handleOpeningAudioRequest(
	req: IncomingMessage,
	res: ServerResponse,
	openai: OpenAI,
) {
	const { text, storyId, narrationVoice, sectionIndex } = JSON.parse(
		await readBody(req),
	);
	if (!text || typeof text !== "string") {
		sendJson(res, 400, { error: "text is required." });
		return;
	}
	if (!storyId || typeof storyId !== "string" || !saveIdPattern.test(storyId)) {
		sendJson(res, 400, { error: "storyId is required." });
		return;
	}
	if (!isNarrationVoiceId(narrationVoice)) {
		sendJson(res, 400, { error: "narrationVoice is required." });
		return;
	}
	const audio = await createOpeningAudio(
		openai,
		text,
		storyId,
		narrationVoice,
		{
			sectionIndex: validSectionIndex(sectionIndex),
		},
	);
	if (!audio) {
		sendJson(res, 500, { error: "Could not generate opening audio." });
		return;
	}
	sendJson(res, 200, audio);
}

function validSectionIndex(value: unknown) {
	return typeof value === "number" && Number.isInteger(value) && value > 0
		? value
		: undefined;
}

export async function handleTranslateWordsRequest(
	req: IncomingMessage,
	res: ServerResponse,
	openai: OpenAI,
) {
	const { words } = JSON.parse(await readBody(req));
	if (!Array.isArray(words) || words.some((w) => typeof w !== "string")) {
		sendJson(res, 400, { error: "words must be a string array." });
		return;
	}
	const { hits, misses } = await lookupWords(words);
	if (misses.length === 0) {
		sendJson(res, 200, { translations: hits });
		return;
	}
	const fresh = await translateWords(openai, misses);
	await storeTranslations(fresh);
	sendJson(res, 200, { translations: { ...hits, ...fresh } });
}

export async function handleRegenerateWordRequest(
	req: IncomingMessage,
	res: ServerResponse,
	openai: OpenAI,
) {
	const { word } = JSON.parse(await readBody(req));
	if (!word || typeof word !== "string") {
		sendJson(res, 400, { error: "word is required." });
		return;
	}
	await evictWord(word);
	const fresh = await translateWords(openai, [word]);
	await storeTranslations(fresh);
	sendJson(res, 200, { translation: fresh[word] ?? null });
}

export async function handleWordAudioRequest(
	req: IncomingMessage,
	res: ServerResponse,
	openai: OpenAI,
) {
	const { word } = JSON.parse(await readBody(req));
	if (!word || typeof word !== "string") {
		sendJson(res, 400, { error: "word is required." });
		return;
	}
	const normalizedWord = word.toLowerCase();
	if (!wordFilePattern.test(`${normalizedWord}.mp3`)) {
		sendJson(res, 400, { error: "word contains unsupported characters." });
		return;
	}
	const url = await getOrCreateWordAudio(openai, normalizedWord);
	sendJson(res, 200, { url });
}

export async function handleRegenerateWordAudioRequest(
	req: IncomingMessage,
	res: ServerResponse,
	openai: OpenAI,
) {
	const { word } = JSON.parse(await readBody(req));
	if (!word || typeof word !== "string") {
		sendJson(res, 400, { error: "word is required." });
		return;
	}
	const normalizedWord = word.toLowerCase();
	if (!wordFilePattern.test(`${normalizedWord}.mp3`)) {
		sendJson(res, 400, { error: "word contains unsupported characters." });
		return;
	}
	const url = await regenerateWordAudio(openai, normalizedWord);
	sendJson(res, 200, { url });
}

export async function handleCompleteRequest(
	req: IncomingMessage,
	res: ServerResponse,
	openai: OpenAI,
	anthropicKey: string,
) {
	const {
		messages,
		maxTokens = STORY_SEGMENT_MAX_TOKENS,
		model = DEFAULT_TEXT_MODEL,
	} = JSON.parse(await readBody(req));
	sendJson(res, 200, {
		text: await completeAi(openai, messages, maxTokens, model, anthropicKey),
	});
}

export async function handleLearnerProfileGetRequest(
	_req: IncomingMessage,
	res: ServerResponse,
) {
	const context = await readLearnerContext();
	sendJson(res, 200, {
		profile: context.languageProfile,
		...context,
	});
}

export async function handleLearnerProfileRefineRequest(
	req: IncomingMessage,
	res: ServerResponse,
	openai: OpenAI,
	anthropicKey: string,
) {
	const { messages } = JSON.parse(await readBody(req));
	if (!Array.isArray(messages)) {
		sendJson(res, 400, { error: "messages must be an array." });
		return;
	}

	if (
		messages.some(
			(message) =>
				!message ||
				(message.role !== "user" && message.role !== "assistant") ||
				typeof message.content !== "string",
		)
	) {
		sendJson(res, 400, {
			error:
				"messages must contain user/assistant messages with string content.",
		});
		return;
	}

	let responseProfile = await readLearnerProfile();
	try {
		const refineTask = learnerProfileRefineQueue
			.catch(() => undefined)
			.then(async () => {
				const [currentProfile, currentPreferences] = await Promise.all([
					readLearnerProfile(),
					readLearnerPreferences(),
				]);
				const today = new Date().toISOString().slice(0, 10);
				const [updated, updatedPreferences] = await Promise.all([
					refineLearnerProfile(
						openai,
						currentProfile,
						messages,
						anthropicKey,
						today,
					),
					refineLearnerPreferencesFromChat(
						openai,
						currentPreferences,
						messages,
						anthropicKey,
						today,
					),
				]);
				await Promise.all([
					writeLearnerProfile(updated),
					writeLearnerPreferences(updatedPreferences),
				]);
				responseProfile = updated;
			});
		learnerProfileRefineQueue = refineTask.then(
			() => undefined,
			() => undefined,
		);
		await refineTask;
		sendJson(res, 200, { profile: responseProfile });
	} catch (err) {
		// Never break the capture loop: keep the existing profile on failure.
		console.warn("Could not refine learner profile.", err);
		sendJson(res, 200, { profile: responseProfile });
	}
}

export async function handleLearnerProfileStoryRefineRequest(
	req: IncomingMessage,
	res: ServerResponse,
	openai: OpenAI,
	anthropicKey: string,
) {
	const { storySummary, feedback } = JSON.parse(await readBody(req));
	if (storySummary !== undefined && typeof storySummary !== "string") {
		sendJson(res, 400, { error: "storySummary must be a string." });
		return;
	}
	if (feedback !== undefined && typeof feedback !== "string") {
		sendJson(res, 400, { error: "feedback must be a string." });
		return;
	}

	let responseProfile = await readLearnerProfile();
	try {
		const refineTask = learnerProfileRefineQueue
			.catch(() => undefined)
			.then(async () => {
				const [current, currentStoryMemory, wordLookupSummary] =
					await Promise.all([
						readLearnerProfile(),
						readStoryMemory(),
						readWordLookupsSinceLastRefine(),
					]);
				const today = new Date().toISOString().slice(0, 10);
				const [updated, updatedStoryMemory] = await Promise.all([
					refineLearnerProfileFromStory(
						openai,
						current,
						{ storySummary, feedback, wordLookups: wordLookupSummary.lookups },
						anthropicKey,
						today,
					),
					refineStoryMemoryFromStory(
						openai,
						currentStoryMemory,
						{ storySummary, feedback },
						anthropicKey,
						today,
					),
				]);
				await Promise.all([
					writeLearnerProfile(updated),
					writeStoryMemory(updatedStoryMemory),
				]);
				// Only mark these lookups consumed once they're durably folded into
				// the written profile, so a failed refine or write can retry them.
				if (wordLookupSummary.cursorCandidate) {
					await advanceWordLogCursor(wordLookupSummary.cursorCandidate);
				}
				responseProfile = updated;
			});
		learnerProfileRefineQueue = refineTask.then(
			() => undefined,
			() => undefined,
		);
		await refineTask;
		sendJson(res, 200, { profile: responseProfile });
	} catch (err) {
		// Never break the story-finish flow: keep the existing profile on failure.
		console.warn("Could not refine learner profile from story.", err);
		sendJson(res, 200, { profile: responseProfile });
	}
}

export async function handleLearnerWordLogRequest(
	req: IncomingMessage,
	res: ServerResponse,
) {
	const { word } = JSON.parse(await readBody(req));
	if (!word || typeof word !== "string") {
		sendJson(res, 400, { error: "word is required." });
		return;
	}
	const normalizedWord = word.toLowerCase();
	if (!learnerWordPattern.test(normalizedWord)) {
		sendJson(res, 400, { error: "word contains unsupported characters." });
		return;
	}
	await appendLearnerWordLogEntry(normalizedWord);
	sendJson(res, 204, null);
}

function storyTextFromMessages(messages: ChatMessage[]) {
	return messages
		.filter((message) => message.role !== "system")
		.map((message) => message.content)
		.join("\n\n")
		.slice(-3000);
}
