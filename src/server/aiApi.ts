import OpenAI from "openai";
import type { Plugin } from "vite";
import {
	handleBackgroundImageRequest,
	handleCompleteRequest,
	handleCompleteStreamRequest,
	handleOpeningAudioRequest,
	handleSpeakRequest,
} from "./aiEndpointHandlers";
import { sendJson } from "./http";
import { sendNdjsonError } from "./ndjson";

type AiApiRoute =
	| "complete"
	| "complete-stream"
	| "background-image"
	| "opening-audio"
	| "speak";

export function aiApi(openaiKey: string, anthropicKey: string): Plugin {
	return {
		name: "ai-proxy-api",
		configureServer(server) {
			const openai = new OpenAI({ apiKey: openaiKey });
			server.middlewares.use(async (req, res, next) => {
				const route = aiApiRoute(req.url, req.method);
				if (!route) {
					next();
					return;
				}

				try {
					if (route === "background-image") {
						await handleBackgroundImageRequest(req, res, openai);
						return;
					}

					if (route === "complete-stream") {
						await handleCompleteStreamRequest(req, res, openai, anthropicKey);
						return;
					}

					if (route === "speak") {
						await handleSpeakRequest(req, res, openai);
						return;
					}

					if (route === "opening-audio") {
						await handleOpeningAudioRequest(req, res, openai);
						return;
					}

					await handleCompleteRequest(req, res, openai, anthropicKey);
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					if (route === "complete-stream" && !res.writableEnded) {
						sendNdjsonError(res, message);
						return;
					}
					sendJson(res, 500, { error: message });
				}
			});
		},
	};
}

function aiApiRoute(
	url: string | undefined,
	method: string | undefined,
): AiApiRoute | null {
	if (method !== "POST") return null;
	switch (url) {
		case "/api/ai/complete":
			return "complete";
		case "/api/ai/complete-stream":
			return "complete-stream";
		case "/api/ai/speak":
			return "speak";
		case "/api/ai/background-image":
			return "background-image";
		case "/api/ai/opening-audio":
			return "opening-audio";
		default:
			return null;
	}
}
