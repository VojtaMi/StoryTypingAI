import OpenAI from "openai";
import type { Plugin } from "vite";
import { normalizeStoryText, readBody, sendJson } from "./http";

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
					const response = await openai.chat.completions.create({
						model: "gpt-4o-mini",
						max_tokens: maxTokens,
						messages,
					});
					const raw = response.choices[0]?.message?.content?.trim();
					if (!raw) {
						sendJson(res, 502, { error: "The AI returned an empty response." });
						return;
					}
					sendJson(res, 200, { text: normalizeStoryText(raw) });
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					sendJson(res, 500, { error: message });
				}
			});
		},
	};
}
