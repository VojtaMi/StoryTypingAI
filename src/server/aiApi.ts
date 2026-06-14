import OpenAI from "openai";
import type { Plugin } from "vite";
import { completeAi } from "./aiService";
import { readBody, sendJson } from "./http";

export function aiApi(apiKey: string): Plugin {
	return {
		name: "ai-proxy-api",
		configureServer(server) {
			const openai = new OpenAI({ apiKey });
			server.middlewares.use(async (req, res, next) => {
				if (req.url !== "/api/ai/complete" || req.method !== "POST") {
					next();
					return;
				}

				try {
					const { messages, maxTokens = 150 } = JSON.parse(await readBody(req));
					sendJson(res, 200, {
						text: await completeAi(openai, messages, maxTokens),
					});
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					sendJson(res, 500, { error: message });
				}
			});
		},
	};
}
