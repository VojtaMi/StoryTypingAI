import OpenAI from "openai";
import type { Plugin } from "vite";
import type { ChatMessage } from "../ai";
import { DEFAULT_TEXT_MODEL } from "../models";
import { completeAi, streamAi } from "./aiService";
import { readBody, sendJson } from "./http";
import { createBackgroundImage, findGenre } from "./openingsStore";
import { saveIdPattern } from "./savesStore";

export function aiApi(openaiKey: string, anthropicKey: string): Plugin {
	return {
		name: "ai-proxy-api",
		configureServer(server) {
			const openai = new OpenAI({ apiKey: openaiKey });
			server.middlewares.use(async (req, res, next) => {
				if (
					(req.url !== "/api/ai/complete" &&
						req.url !== "/api/ai/complete-stream" &&
						req.url !== "/api/ai/background-image") ||
					req.method !== "POST"
				) {
					next();
					return;
				}

				try {
					if (req.url === "/api/ai/background-image") {
						const { genreId, messages, storyId } = JSON.parse(
							await readBody(req),
						);
						const genre = findGenre(genreId);
						if (!genre) {
							sendJson(res, 404, { error: "Genre not found." });
							return;
						}
						if (
							!storyId ||
							typeof storyId !== "string" ||
							!saveIdPattern.test(storyId)
						) {
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
						return;
					}

					if (req.url === "/api/ai/complete-stream") {
						const {
							messages,
							maxTokens = 150,
							model = DEFAULT_TEXT_MODEL,
						} = JSON.parse(await readBody(req));
						res.statusCode = 200;
						res.setHeader("Content-Type", "application/x-ndjson");
						res.setHeader("Cache-Control", "no-cache");
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
						return;
					}

					const {
						messages,
						maxTokens = 150,
						model = DEFAULT_TEXT_MODEL,
					} = JSON.parse(await readBody(req));
					sendJson(res, 200, {
						text: await completeAi(
							openai,
							messages,
							maxTokens,
							model,
							anthropicKey,
						),
					});
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					if (req.url === "/api/ai/complete-stream" && !res.writableEnded) {
						if (!res.headersSent) {
							res.statusCode = 200;
							res.setHeader("Content-Type", "application/x-ndjson");
							res.setHeader("Cache-Control", "no-cache");
						}
						writeJsonLine(res, { type: "error", error: message });
						res.end();
						return;
					}
					sendJson(res, 500, { error: message });
				}
			});
		},
	};
}

function writeJsonLine(res: NodeJS.WritableStream, body: unknown) {
	res.write(`${JSON.stringify(body)}\n`);
}

function storyTextFromMessages(messages: ChatMessage[]) {
	return messages
		.filter((message) => message.role !== "system")
		.map((message) => message.content)
		.join("\n\n")
		.slice(-3000);
}
