import OpenAI from "openai";
import type { Plugin } from "vite";
import { readBody, sendJson } from "./http";
import {
	getOrCreateLessonAudio,
	lessonAudioFilePattern,
	lessonIdPattern,
	readLessonAudio,
} from "./lessonAudioStore";

export function lessonAudioApi(openaiKey: string): Plugin {
	return {
		name: "lesson-audio-api",
		configureServer(server) {
			const openai = new OpenAI({ apiKey: openaiKey });
			server.middlewares.use(async (req, res, next) => {
				if (!req.url?.startsWith("/api/lesson-audio")) {
					next();
					return;
				}

				try {
					const url = new URL(req.url, "http://localhost");
					const parts = url.pathname.split("/").filter(Boolean);

					// POST /api/lesson-audio — generate or return cached URL
					if (parts.length === 2 && req.method === "POST") {
						const { lessonId, text, instructions } = JSON.parse(
							await readBody(req),
						);
						if (
							!lessonId ||
							typeof lessonId !== "string" ||
							!lessonIdPattern.test(lessonId)
						) {
							sendJson(res, 400, { error: "lessonId is required." });
							return;
						}
						if (!text || typeof text !== "string") {
							sendJson(res, 400, { error: "text is required." });
							return;
						}
						const audioUrl = await getOrCreateLessonAudio(
							openai,
							lessonId,
							text,
							typeof instructions === "string" ? instructions : undefined,
						);
						sendJson(res, 200, { url: audioUrl });
						return;
					}

					// GET /api/lesson-audio/:lessonId/:filename — serve file
					if (parts.length === 4 && req.method === "GET") {
						const lessonId = decodeURIComponent(parts[2] ?? "");
						const filename = decodeURIComponent(parts[3] ?? "");
						if (
							!lessonIdPattern.test(lessonId) ||
							!lessonAudioFilePattern.test(filename)
						) {
							sendJson(res, 404, { error: "Audio not found." });
							return;
						}
						try {
							const file = await readLessonAudio(lessonId, filename);
							res.statusCode = 200;
							res.setHeader("Content-Type", "audio/mpeg");
							res.setHeader(
								"Cache-Control",
								"public, max-age=31536000, immutable",
							);
							res.end(file);
						} catch {
							sendJson(res, 404, { error: "Audio not found." });
						}
						return;
					}

					sendJson(res, 404, { error: "Not found." });
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					sendJson(res, 500, { error: message });
				}
			});
		},
	};
}
