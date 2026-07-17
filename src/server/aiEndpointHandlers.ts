import type { IncomingMessage, ServerResponse } from "node:http";
import type OpenAI from "openai";
import type { ChatMessage } from "../ai";
import { DEFAULT_TEXT_MODEL, STORY_SEGMENT_MAX_TOKENS } from "../models";
import { isNarrationVoiceId } from "../narrationVoice";
import {
	completeAi,
	completeStructuredAi,
	streamAi,
	translateWords,
} from "./aiService";
import { withAiTraceMetadata } from "./aiTrace";
import { readBody, sendJson } from "./http";
import { enqueueLearnerProfileMutation } from "./learnerProfileMutationQueue";
import { refineLearnerStateFromChat } from "./learnerProfileService";
import { readLearnerContext, writeLearnerContext } from "./learnerProfileStore";
import { appendLearnerWordLogEntry } from "./learnerWordLogStore";
import { startNdjsonResponse, writeJsonLine } from "./ndjson";
import { createBackgroundImage, findGenre } from "./openingsStore";
import { saveIdPattern } from "./savesStore";
import { createOpeningAudio } from "./storyAudioStore";
import {
	finalizeStoryEvidence,
	type StoryFinalizationInput,
} from "./storyFinalizationService";
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
		await withAiTraceMetadata(
			{ storyId, storyPhase: "media", mediaType: "background-image" },
			() =>
				createBackgroundImage(
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
	const audio = await withAiTraceMetadata(
		{ storyId, storyPhase: "media", mediaType: "narration" },
		() =>
			createOpeningAudio(openai, text, storyId, narrationVoice, {
				sectionIndex: validSectionIndex(sectionIndex),
			}),
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
		responseFormat = "text",
	} = JSON.parse(await readBody(req));
	if (responseFormat !== "text" && responseFormat !== "json") {
		sendJson(res, 400, { error: "responseFormat must be text or json." });
		return;
	}
	const complete =
		responseFormat === "json" ? completeStructuredAi : completeAi;
	sendJson(res, 200, {
		text: await complete(openai, messages, maxTokens, model, anthropicKey),
	});
}

export async function handleLearnerProfileGetRequest(
	_req: IncomingMessage,
	res: ServerResponse,
) {
	const context = await readLearnerContext();
	sendJson(res, 200, context);
}

export async function handleLearnerPreferencesUpdateRequest(
	req: IncomingMessage,
	res: ServerResponse,
) {
	const body = JSON.parse(await readBody(req));
	const fields = ["prefer", "avoid"] as const;
	if (
		!body ||
		typeof body !== "object" ||
		fields.some(
			(field) =>
				body[field] !== undefined &&
				(!Array.isArray(body[field]) ||
					body[field].some((item: unknown) => typeof item !== "string")),
		)
	) {
		sendJson(res, 400, { error: "Preferences must contain string arrays." });
		return;
	}

	try {
		const updated = await enqueueLearnerProfileMutation(async () => {
			const current = await readLearnerContext();
			const preferences = {
				...current.preferences,
				...Object.fromEntries(
					fields
						.filter((field) => body[field] !== undefined)
						.map((field) => [field, body[field]]),
				),
				updated: new Date().toISOString().slice(0, 10),
			};
			await writeLearnerContext({ ...current, preferences });
			return preferences;
		});
		sendJson(res, 200, updated);
	} catch (err) {
		console.warn("Could not update learner preferences.", err);
		sendJson(res, 400, { error: "Could not save valid learner preferences." });
	}
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

	let responseProfile = (await readLearnerContext()).languageProfile;
	try {
		const refineTask = enqueueLearnerProfileMutation(async () => {
			const current = await readLearnerContext();
			const today = new Date().toISOString().slice(0, 10);
			const updated = await refineLearnerStateFromChat(
				openai,
				current,
				messages,
				anthropicKey,
				today,
			);
			await writeLearnerContext(updated);
			responseProfile = updated.languageProfile;
		});
		await refineTask;
		sendJson(res, 200, { profile: responseProfile });
	} catch (err) {
		// Never break the capture loop: keep the existing profile on failure.
		console.warn("Could not refine learner profile.", err);
		sendJson(res, 200, { profile: responseProfile });
	}
}

export async function handleFinalizeStoryEvidenceRequest(
	req: IncomingMessage,
	res: ServerResponse,
	openai: OpenAI,
	anthropicKey: string,
) {
	const body = JSON.parse(
		await readBody(req),
	) as Partial<StoryFinalizationInput>;
	if (typeof body.storyId !== "string" || !saveIdPattern.test(body.storyId)) {
		sendJson(res, 400, { error: "storyId must be a valid story ID." });
		return;
	}
	if (typeof body.storySummary !== "string" || !body.storySummary.trim()) {
		sendJson(res, 400, { error: "storySummary must be a non-empty string." });
		return;
	}
	if (
		!Array.isArray(body.learnerQuestions) ||
		body.learnerQuestions.some((question) => typeof question !== "string")
	) {
		sendJson(res, 400, {
			error: "learnerQuestions must be an array of strings.",
		});
		return;
	}
	const invalidRecapResults =
		!Array.isArray(body.recapResults) ||
		body.recapResults.some((result) => {
			return (
				!result ||
				typeof result.type !== "string" ||
				typeof result.label !== "string" ||
				typeof result.attempts !== "number" ||
				!Number.isFinite(result.attempts) ||
				result.attempts < 1
			);
		});
	if (invalidRecapResults) {
		sendJson(res, 400, {
			error: "recapResults must be an array of {type, label, attempts}.",
		});
		return;
	}
	if (body.feedback !== undefined && typeof body.feedback !== "string") {
		sendJson(res, 400, { error: "feedback must be a string." });
		return;
	}

	const profile = await finalizeStoryEvidence(
		openai,
		{
			storyId: body.storyId,
			storySummary: body.storySummary,
			learnerQuestions: body.learnerQuestions ?? [],
			recapResults: body.recapResults ?? [],
			feedback: body.feedback,
		},
		anthropicKey,
	);
	sendJson(res, 200, { profile });
}

export async function handleLearnerWordLogRequest(
	req: IncomingMessage,
	res: ServerResponse,
) {
	const { word, storyId } = JSON.parse(await readBody(req));
	if (!word || typeof word !== "string") {
		sendJson(res, 400, { error: "word is required." });
		return;
	}
	if (
		storyId !== undefined &&
		(typeof storyId !== "string" || !saveIdPattern.test(storyId))
	) {
		sendJson(res, 400, { error: "storyId must be a valid story ID." });
		return;
	}
	const normalizedWord = word.toLowerCase();
	if (!learnerWordPattern.test(normalizedWord)) {
		sendJson(res, 400, { error: "word contains unsupported characters." });
		return;
	}
	await appendLearnerWordLogEntry(normalizedWord, storyId);
	sendJson(res, 204, null);
}

function storyTextFromMessages(messages: ChatMessage[]) {
	return messages
		.filter((message) => message.role !== "system")
		.map((message) => message.content)
		.join("\n\n")
		.slice(-3000);
}
