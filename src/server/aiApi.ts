import OpenAI from "openai";
import type { Plugin } from "vite";
import type { ChatMessage } from "../ai";
import { DEFAULT_TEXT_MODEL } from "../models";
import { completeAi } from "./aiService";
import { readBody, sendJson } from "./http";
import { createBackgroundImage, findGenre } from "./openingsStore";

export function aiApi(openaiKey: string, anthropicKey: string): Plugin {
	return {
		name: "ai-proxy-api",
		configureServer(server) {
			const openai = new OpenAI({ apiKey: openaiKey });
			server.middlewares.use(async (req, res, next) => {
				if (
					(req.url !== "/api/ai/complete" &&
						req.url !== "/api/ai/background-image") ||
					req.method !== "POST"
				) {
					next();
					return;
				}

				try {
					if (req.url === "/api/ai/background-image") {
						const { genreId, messages } = JSON.parse(await readBody(req));
						const genre = findGenre(genreId);
						if (!genre) {
							sendJson(res, 404, { error: "Genre not found." });
							return;
						}
						sendJson(
							res,
							200,
							await createBackgroundImage(
								openai,
								genre,
								storyTextFromMessages(messages),
							),
						);
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
					sendJson(res, 500, { error: message });
				}
			});
		},
	};
}

function storyTextFromMessages(messages: ChatMessage[]) {
	return messages
		.filter((message) => message.role !== "system")
		.map((message) => message.content)
		.join("\n\n")
		.slice(-3000);
}
