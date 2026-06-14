import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import type { GenreId } from "../genres";
import { completeAi } from "./aiService";
import { readBody, sendJson } from "./http";
import {
	consumePreparedOpening,
	findGenre,
	imageFilePattern,
	listPreparedOpenings,
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

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 80;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
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
			preparePromise ??= prepareMissingOpenings(openai).finally(() => {
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
			const filename = decodeURIComponent(parts[2] ?? "");
			if (!imageFilePattern.test(filename)) {
				sendJson(res, 404, { error: "Image not found." });
				return;
			}
			try {
				const file = await readStoryImage(filename);
				res.statusCode = 200;
				res.setHeader("Content-Type", "image/webp");
				res.setHeader("Cache-Control", "no-store");
				res.end(file);
			} catch {
				sendJson(res, 404, { error: "Image not found." });
			}
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
			const { messages, maxTokens = 150 } = JSON.parse(await readBody(req));
			sendJson(res, 200, {
				text: await completeAi(openai, messages, maxTokens),
			});
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
