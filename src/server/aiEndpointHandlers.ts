import type { IncomingMessage, ServerResponse } from "node:http";
import type OpenAI from "openai";
import type { ChatMessage } from "../ai";
import { DEFAULT_TEXT_MODEL } from "../models";
import { completeAi, streamAi } from "./aiService";
import { readBody, sendJson } from "./http";
import { startNdjsonResponse, writeJsonLine } from "./ndjson";
import { createBackgroundImage, findGenre } from "./openingsStore";
import { saveIdPattern } from "./savesStore";

export async function handleBackgroundImageRequest(
	req: IncomingMessage,
	res: ServerResponse,
	openai: OpenAI,
) {
	const { genreId, messages, storyId } = JSON.parse(await readBody(req));
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
		maxTokens = 150,
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

export async function handleCompleteRequest(
	req: IncomingMessage,
	res: ServerResponse,
	openai: OpenAI,
	anthropicKey: string,
) {
	const {
		messages,
		maxTokens = 150,
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
