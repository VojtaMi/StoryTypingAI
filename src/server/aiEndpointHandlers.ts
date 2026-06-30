import type { IncomingMessage, ServerResponse } from "node:http";
import type OpenAI from "openai";
import type { ChatMessage } from "../ai";
import { DEFAULT_TEXT_MODEL, STORY_SEGMENT_MAX_TOKENS } from "../models";
import { isNarrationVoiceId } from "../narrationVoice";
import {
	completeAi,
	streamAi,
	synthesizeSpeech,
	translateWords,
} from "./aiService";
import { readBody, sendJson } from "./http";
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

export async function handleSpeakRequest(
	req: IncomingMessage,
	res: ServerResponse,
	openai: OpenAI,
) {
	const { text, instructions } = JSON.parse(await readBody(req));
	if (!text || typeof text !== "string") {
		sendJson(res, 400, { error: "text is required." });
		return;
	}
	const audio = await synthesizeSpeech(openai, text, {
		instructions: typeof instructions === "string" ? instructions : undefined,
	});
	res.statusCode = 200;
	res.setHeader("Content-Type", "audio/mpeg");
	res.setHeader("Cache-Control", "no-store");
	res.end(audio);
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

function storyTextFromMessages(messages: ChatMessage[]) {
	return messages
		.filter((message) => message.role !== "system")
		.map((message) => message.content)
		.join("\n\n")
		.slice(-3000);
}
