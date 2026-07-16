import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type OpenAI from "openai";
import type { ChatMessage } from "../ai";
import { DEFAULT_TEXT_MODEL, STORY_SEGMENT_MAX_TOKENS } from "../models";
import { isNarrationVoiceId } from "../narrationVoice";
import { completeAi, streamAi, translateWords } from "./aiService";
import { withAiTraceMetadata } from "./aiTrace";
import { readBody, sendJson } from "./http";
import {
	refineLearnerPreferencesFromChat,
	refineLearnerProfile,
	refineLearnerProfileFromRecap,
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
	pruneWordLogForStory,
	readWordLookupsForStory,
	readWordLookupsSinceLastRefine,
} from "./learnerWordLogStore";
import { startNdjsonResponse, writeJsonLine } from "./ndjson";
import { createBackgroundImage, findGenre } from "./openingsStore";
import { saveIdPattern } from "./savesStore";
import { createOpeningAudio } from "./storyAudioStore";
import {
	readFinishEvidence,
	updateFinishEvidence,
} from "./storyFinishEvidenceStore";
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

/**
 * Folds a story's own difficulty feedback into the profile and story memory.
 * Used both when late feedback arrives (feedback-only, same story) and when a
 * baseline finds feedback that raced ahead of it. Deliberately does NOT re-send
 * word lookups: those were already folded at baseline, and re-sending them would
 * teach the same words twice. `storySummary` is context only (which story).
 */
async function applyStoryFeedbackUpdate(
	openai: OpenAI,
	anthropicKey: string,
	storySummary: string | undefined,
	feedback: string,
): Promise<string> {
	const [current, currentStoryMemory] = await Promise.all([
		readLearnerProfile(),
		readStoryMemory(),
	]);
	const today = new Date().toISOString().slice(0, 10);
	const [updated, updatedStoryMemory] = await Promise.all([
		refineLearnerProfileFromStory(
			openai,
			current,
			{ storySummary, feedback },
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
	return updated;
}

/**
 * Baseline finalization when a reading story ends. Idempotent: the finish-evidence
 * record's `baselineRefinedAt` guards it so the two baseline calls (profile +
 * story memory) run at most once per story. Folds this story's scoped word
 * lookups plus any unscoped (menu/standalone) lookups since the global cursor,
 * plus the learner's buffered tutor questions. Applies any feedback that raced
 * ahead of it in the same pass.
 */
export async function handleLearnerProfileStoryRefineRequest(
	req: IncomingMessage,
	res: ServerResponse,
	openai: OpenAI,
	anthropicKey: string,
) {
	const { storyId, storySummary, learnerQuestions } = JSON.parse(
		await readBody(req),
	);
	if (typeof storyId !== "string" || !saveIdPattern.test(storyId)) {
		sendJson(res, 400, { error: "storyId must be a valid story ID." });
		return;
	}
	if (storySummary !== undefined && typeof storySummary !== "string") {
		sendJson(res, 400, { error: "storySummary must be a string." });
		return;
	}
	if (
		learnerQuestions !== undefined &&
		(!Array.isArray(learnerQuestions) ||
			learnerQuestions.some((question) => typeof question !== "string"))
	) {
		sendJson(res, 400, { error: "learnerQuestions must be strings." });
		return;
	}

	let responseProfile = await readLearnerProfile();
	try {
		const refineTask = learnerProfileRefineQueue
			.catch(() => undefined)
			.then(() =>
				withAiTraceMetadata({ storyId, storyPhase: "finish" }, async () => {
					const record = await readFinishEvidence(storyId);
					if (record.baselineRefinedAt) {
						// Apply-once: the baseline already ran for this story.
						responseProfile = await readLearnerProfile();
						return;
					}

					const [current, currentStoryMemory, scoped, unscoped] =
						await Promise.all([
							readLearnerProfile(),
							readStoryMemory(),
							readWordLookupsForStory(storyId),
							readWordLookupsSinceLastRefine(),
						]);
					const today = new Date().toISOString().slice(0, 10);
					const [updated, updatedStoryMemory] = await Promise.all([
						refineLearnerProfileFromStory(
							openai,
							current,
							{
								storySummary,
								wordLookups: [...scoped.lookups, ...unscoped.lookups],
								learnerQuestions,
							},
							anthropicKey,
							today,
						),
						refineStoryMemoryFromStory(
							openai,
							currentStoryMemory,
							{ storySummary },
							anthropicKey,
							today,
						),
					]);
					// Write order matters: durable handouts first, cursor/prune next, and
					// the `baselineRefinedAt` stamp LAST — a crash before the stamp lands
					// re-runs the baseline (a repeat) rather than skipping a partial write.
					await writeLearnerProfile(updated);
					await writeStoryMemory(updatedStoryMemory);
					await pruneWordLogForStory(storyId);
					if (unscoped.cursorCandidate) {
						await advanceWordLogCursor(unscoped.cursorCandidate);
					}

					const now = new Date().toISOString();
					let finalProfile = updated;
					const patch: Parameters<typeof updateFinishEvidence>[1] = {
						baselineRefinedAt: now,
						storySummary,
						wordLookups: scoped.aggregated,
						globalWordLookups: unscoped.aggregated,
					};
					if (record.pendingFeedback?.trim()) {
						finalProfile = await applyStoryFeedbackUpdate(
							openai,
							anthropicKey,
							storySummary,
							record.pendingFeedback,
						);
						patch.feedbackRefinedAt = now;
						patch.appliedFeedback = record.pendingFeedback;
						patch.pendingFeedback = undefined;
					}
					await updateFinishEvidence(storyId, patch);
					responseProfile = finalProfile;
				}),
			);
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

/**
 * A late custom-feedback update, applied to one story only. It never reads or
 * advances the global word cursor, so feedback submitted after the next story
 * has begun can't consume that story's lookups. If the baseline hasn't run yet,
 * the feedback is stashed as pending and applied when the baseline completes.
 */
export async function handleStoryFeedbackRefineRequest(
	req: IncomingMessage,
	res: ServerResponse,
	openai: OpenAI,
	anthropicKey: string,
) {
	const { storyId, feedback } = JSON.parse(await readBody(req));
	if (typeof storyId !== "string" || !saveIdPattern.test(storyId)) {
		sendJson(res, 400, { error: "storyId must be a valid story ID." });
		return;
	}
	if (typeof feedback !== "string" || !feedback.trim()) {
		sendJson(res, 400, { error: "feedback must be a non-empty string." });
		return;
	}

	let responseProfile = await readLearnerProfile();
	try {
		const refineTask = learnerProfileRefineQueue
			.catch(() => undefined)
			.then(() =>
				withAiTraceMetadata({ storyId, storyPhase: "feedback" }, async () => {
					const record = await readFinishEvidence(storyId);
					if (!record.baselineRefinedAt) {
						// Baseline hasn't run; don't reconstruct it. Stash the feedback so
						// the baseline op (same queue) folds it when it completes.
						await updateFinishEvidence(storyId, { pendingFeedback: feedback });
						responseProfile = await readLearnerProfile();
						return;
					}
					if (record.feedbackRefinedAt && record.appliedFeedback === feedback) {
						// Idempotent: this exact feedback was already applied.
						responseProfile = await readLearnerProfile();
						return;
					}
					const updated = await applyStoryFeedbackUpdate(
						openai,
						anthropicKey,
						record.storySummary,
						feedback,
					);
					await updateFinishEvidence(storyId, {
						feedbackRefinedAt: new Date().toISOString(),
						appliedFeedback: feedback,
					});
					responseProfile = updated;
				}),
			);
		learnerProfileRefineQueue = refineTask.then(
			() => undefined,
			() => undefined,
		);
		await refineTask;
		sendJson(res, 200, { profile: responseProfile });
	} catch (err) {
		// Never break the story-finish flow: keep the existing profile on failure.
		console.warn("Could not refine learner profile from feedback.", err);
		sendJson(res, 200, { profile: responseProfile });
	}
}

export async function handleLearnerProfileRecapRefineRequest(
	req: IncomingMessage,
	res: ServerResponse,
	openai: OpenAI,
	anthropicKey: string,
) {
	const { storyId, results } = JSON.parse(await readBody(req));
	if (
		storyId !== undefined &&
		(typeof storyId !== "string" || !saveIdPattern.test(storyId))
	) {
		sendJson(res, 400, { error: "storyId must be a valid story ID." });
		return;
	}
	if (
		!Array.isArray(results) ||
		results.some(
			(result) =>
				!result ||
				typeof result.type !== "string" ||
				typeof result.label !== "string" ||
				typeof result.attempts !== "number" ||
				!Number.isFinite(result.attempts) ||
				result.attempts < 1,
		)
	) {
		sendJson(res, 400, {
			error: "results must be an array of {type, label, attempts}.",
		});
		return;
	}

	let responseProfile = await readLearnerProfile();
	try {
		const refineTask = learnerProfileRefineQueue
			.catch(() => undefined)
			.then(() =>
				withAiTraceMetadata(
					{ ...(storyId ? { storyId } : {}), storyPhase: "recap" },
					async () => {
						const resultsHash = createHash("sha256")
							.update(JSON.stringify(results))
							.digest("hex");
						if (storyId) {
							const record = await readFinishEvidence(storyId);
							if (
								record.recapRefinedAt &&
								record.recapResultsHash === resultsHash
							) {
								// Idempotent: these exact recap results were already applied.
								responseProfile = await readLearnerProfile();
								return;
							}
						}
						const current = await readLearnerProfile();
						const today = new Date().toISOString().slice(0, 10);
						const updated = await refineLearnerProfileFromRecap(
							openai,
							current,
							results,
							anthropicKey,
							today,
						);
						await writeLearnerProfile(updated);
						if (storyId) {
							await updateFinishEvidence(storyId, {
								recapRefinedAt: new Date().toISOString(),
								recapResultsHash: resultsHash,
							});
						}
						responseProfile = updated;
					},
				),
			);
		learnerProfileRefineQueue = refineTask.then(
			() => undefined,
			() => undefined,
		);
		await refineTask;
		sendJson(res, 200, { profile: responseProfile });
	} catch (err) {
		// Never break the story-finish flow: keep the existing profile on failure.
		console.warn("Could not refine learner profile from recap.", err);
		sendJson(res, 200, { profile: responseProfile });
	}
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
