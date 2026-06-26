import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import type { ChatMessage } from "../ai";
import type { GenreId } from "../genres";
import { DEFAULT_TEXT_MODEL } from "../models";
import { isNarrationVoiceId } from "../narrationVoice";
import { completeAi, synthesizeSpeech } from "./aiService";
import { readBody, sendJson } from "./http";
import {
	getOrCreateLessonAudio,
	lessonAudioFilePattern,
	lessonIdPattern,
	readLessonAudio,
} from "./lessonAudioStore";
import {
	consumePreparedOpening,
	createBackgroundImage,
	findGenre,
	imageFilePattern,
	listPreparedOpenings,
	listStoryImages,
	prepareMissingOpenings,
	readStoryImage,
} from "./openingsStore";
import {
	deleteSave,
	listSaves,
	readSave,
	saveIdPattern,
	writeSave,
} from "./savesStore";
import {
	audioFilePattern,
	createOpeningAudio,
	readStoryAudio,
} from "./storyAudioStore";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 80;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const distDir = join(__dirname, "dist");

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
let preparePromise: Promise<void> | null = null;

const mimeTypes: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "application/javascript",
	".mjs": "application/javascript",
	".css": "text/css",
	".webp": "image/webp",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".json": "application/json",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
};

async function serveStatic(
	res: Parameters<typeof sendJson>[0],
	urlPath: string,
) {
	const filePath = join(distDir, urlPath === "/" ? "index.html" : urlPath);
	try {
		const content = await readFile(filePath);
		const mime = mimeTypes[extname(filePath)] ?? "application/octet-stream";
		res.setHeader("Content-Type", mime);
		res.statusCode = 200;
		res.end(content);
	} catch {
		try {
			const content = await readFile(join(distDir, "index.html"));
			res.setHeader("Content-Type", "text/html; charset=utf-8");
			res.statusCode = 200;
			res.end(content);
		} catch {
			res.statusCode = 404;
			res.end("Not found");
		}
	}
}

const server = createServer(async (req, res) => {
	const url = new URL(req.url ?? "/", "http://localhost");
	const pathname = url.pathname;
	const parts = pathname.split("/").filter(Boolean);

	try {
		if (pathname === "/api/openings" && req.method === "GET") {
			sendJson(res, 200, await listPreparedOpenings());
			return;
		}

		if (pathname === "/api/openings/prepare" && req.method === "POST") {
			const body = req.headers["content-length"]
				? JSON.parse(await readBody(req))
				: {};
			preparePromise ??= prepareMissingOpenings(
				openai,
				body.model,
				ANTHROPIC_API_KEY,
			).finally(() => {
				preparePromise = null;
			});
			await preparePromise;
			sendJson(res, 200, await listPreparedOpenings());
			return;
		}

		if (
			parts.length === 4 &&
			parts[0] === "api" &&
			parts[1] === "openings" &&
			parts[3] === "consume" &&
			req.method === "POST"
		) {
			const genreId = parts[2];
			if (!genreId || !findGenre(genreId)) {
				sendJson(res, 404, { error: "Genre not found." });
				return;
			}
			sendJson(res, 200, await consumePreparedOpening(genreId as GenreId));
			return;
		}

		if (
			parts[0] === "api" &&
			parts[1] === "story-images" &&
			req.method === "GET"
		) {
			const storyIdPattern = /^[a-zA-Z0-9_-]+$/;
			const imageParts = parts.slice(2);
			let relativePath: string;
			if (imageParts.length === 1) {
				const filename = decodeURIComponent(imageParts[0] ?? "");
				if (!imageFilePattern.test(filename)) {
					sendJson(res, 404, { error: "Image not found." });
					return;
				}
				relativePath = filename;
			} else if (imageParts.length === 2) {
				const storyId = decodeURIComponent(imageParts[0] ?? "");
				const filename = decodeURIComponent(imageParts[1] ?? "");
				if (!storyIdPattern.test(storyId) || !imageFilePattern.test(filename)) {
					sendJson(res, 404, { error: "Image not found." });
					return;
				}
				relativePath = `${storyId}/${filename}`;
			} else {
				sendJson(res, 404, { error: "Image not found." });
				return;
			}
			try {
				const file = await readStoryImage(relativePath);
				res.statusCode = 200;
				res.setHeader("Content-Type", "image/webp");
				res.setHeader("Cache-Control", "no-store");
				res.end(file);
			} catch {
				sendJson(res, 404, { error: "Image not found." });
			}
			return;
		}

		if (
			parts[0] === "api" &&
			parts[1] === "story-audio" &&
			req.method === "GET"
		) {
			const storyIdPattern = /^[a-zA-Z0-9_-]+$/;
			const audioParts = parts.slice(2);
			if (audioParts.length !== 2) {
				sendJson(res, 404, { error: "Audio not found." });
				return;
			}
			const storyId = decodeURIComponent(audioParts[0] ?? "");
			const filename = decodeURIComponent(audioParts[1] ?? "");
			if (!storyIdPattern.test(storyId) || !audioFilePattern.test(filename)) {
				sendJson(res, 404, { error: "Audio not found." });
				return;
			}
			try {
				const file = await readStoryAudio(`${storyId}/${filename}`);
				res.statusCode = 200;
				res.setHeader("Content-Type", "audio/mpeg");
				res.setHeader("Cache-Control", "no-store");
				res.end(file);
			} catch {
				sendJson(res, 404, { error: "Audio not found." });
			}
			return;
		}

		if (
			parts.length === 3 &&
			parts[0] === "api" &&
			parts[1] === "gallery" &&
			req.method === "GET"
		) {
			const storyId = decodeURIComponent(parts[2] ?? "");
			if (!storyId || !saveIdPattern.test(storyId)) {
				sendJson(res, 404, { error: "Story not found." });
				return;
			}
			sendJson(res, 200, await listStoryImages(storyId));
			return;
		}

		if (pathname === "/api/saves" && req.method === "GET") {
			sendJson(res, 200, await listSaves());
			return;
		}

		if (parts.length === 3 && parts[0] === "api" && parts[1] === "saves") {
			const id = parts[2];
			if (!id || !saveIdPattern.test(id)) {
				sendJson(res, 404, { error: "Save not found." });
				return;
			}

			if (req.method === "GET") {
				const save = await readSave(id);
				if (!save) {
					sendJson(res, 404, { error: "Save not found." });
					return;
				}
				sendJson(res, 200, save);
				return;
			}

			if (req.method === "PUT") {
				const save = JSON.parse(await readBody(req));
				if (save.id !== id) {
					sendJson(res, 400, { error: "Save id does not match URL." });
					return;
				}
				await writeSave(id, save);
				sendJson(res, 200, save);
				return;
			}

			if (req.method === "DELETE") {
				await deleteSave(id);
				sendJson(res, 204, null);
				return;
			}

			sendJson(res, 405, { error: "Method not allowed." });
			return;
		}

		if (pathname === "/api/ai/complete" && req.method === "POST") {
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
					ANTHROPIC_API_KEY,
				),
			});
			return;
		}

		if (pathname === "/api/ai/speak" && req.method === "POST") {
			const { text, instructions } = JSON.parse(await readBody(req));
			if (!text || typeof text !== "string") {
				sendJson(res, 400, { error: "text is required." });
				return;
			}
			const audio = await synthesizeSpeech(openai, text, {
				instructions:
					typeof instructions === "string" ? instructions : undefined,
			});
			res.statusCode = 200;
			res.setHeader("Content-Type", "audio/mpeg");
			res.setHeader("Cache-Control", "no-store");
			res.end(audio);
			return;
		}

		if (pathname === "/api/lesson-audio" && req.method === "POST") {
			const { lessonId, text, instructions } = JSON.parse(await readBody(req));
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
			const url = await getOrCreateLessonAudio(
				openai,
				lessonId,
				text,
				typeof instructions === "string" ? instructions : undefined,
			);
			sendJson(res, 200, { url });
			return;
		}

		if (
			parts[0] === "api" &&
			parts[1] === "lesson-audio" &&
			parts.length === 4 &&
			req.method === "GET"
		) {
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
				res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
				res.end(file);
			} catch {
				sendJson(res, 404, { error: "Audio not found." });
			}
			return;
		}

		if (pathname === "/api/ai/opening-audio" && req.method === "POST") {
			const { text, storyId, narrationVoice } = JSON.parse(await readBody(req));
			if (!text || typeof text !== "string") {
				sendJson(res, 400, { error: "text is required." });
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
			if (!isNarrationVoiceId(narrationVoice)) {
				sendJson(res, 400, { error: "narrationVoice is required." });
				return;
			}
			const audio = await createOpeningAudio(
				openai,
				text,
				storyId,
				narrationVoice,
			);
			if (!audio) {
				sendJson(res, 500, { error: "Could not generate opening audio." });
				return;
			}
			sendJson(res, 200, audio);
			return;
		}

		if (pathname === "/api/ai/background-image" && req.method === "POST") {
			const { genreId, messages, storyId } = JSON.parse(await readBody(req));
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

		await serveStatic(res, pathname);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(err);
		sendJson(res, 500, { error: message });
	}
});

server.listen(PORT, () => {
	console.log(`Listening on port ${PORT}`);
});

function storyTextFromMessages(messages: ChatMessage[]) {
	return messages
		.filter((message) => message.role !== "system")
		.map((message) => message.content)
		.join("\n\n")
		.slice(-3000);
}
