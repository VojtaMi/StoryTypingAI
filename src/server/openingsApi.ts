import OpenAI from "openai";
import type { Plugin } from "vite";
import type { GenreId } from "../genres";
import { readBody, sendJson } from "./http";
import {
	consumePreparedOpening,
	findGenre,
	imageFilePattern,
	listPreparedOpenings,
	prepareMissingOpenings,
	readStoryImage,
} from "./openingsStore";

export function openingsApi(apiKey: string, anthropicKey: string): Plugin {
	let preparePromise: Promise<void> | null = null;

	return {
		name: "prepared-openings-api",
		configureServer(server) {
			const openai = new OpenAI({ apiKey });

			server.middlewares.use(async (req, res, next) => {
				if (!req.url?.startsWith("/api/openings")) {
					next();
					return;
				}

				try {
					const url = new URL(req.url, "http://localhost");
					const parts = url.pathname.split("/").filter(Boolean);
					const genreId = parts[2] as GenreId | undefined;

					if (parts.length === 2 && req.method === "GET") {
						sendJson(res, 200, await listPreparedOpenings());
						return;
					}

					if (
						parts.length === 3 &&
						parts[2] === "prepare" &&
						req.method === "POST"
					) {
						const body = req.headers["content-length"]
							? JSON.parse(await readBody(req))
							: {};
						preparePromise ??= prepareMissingOpenings(
							openai,
							body.model,
							anthropicKey,
						).finally(() => {
							preparePromise = null;
						});
						await preparePromise;
						sendJson(res, 200, await listPreparedOpenings());
						return;
					}

					if (
						parts.length === 4 &&
						parts[3] === "consume" &&
						req.method === "POST" &&
						genreId
					) {
						if (!findGenre(genreId)) {
							sendJson(res, 404, { error: "Genre not found." });
							return;
						}

						const opening = await consumePreparedOpening(genreId);
						sendJson(res, 200, opening);
						return;
					}

					sendJson(res, 404, { error: "Opening not found." });
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					sendJson(res, 500, { error: message });
				}
			});
		},
	};
}

export function storyImagesApi(): Plugin {
	return {
		name: "story-images-api",
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				if (!req.url?.startsWith("/api/story-images/")) {
					next();
					return;
				}

				try {
					const url = new URL(req.url, "http://localhost");
					const parts = url.pathname.split("/");
					const filename = decodeURIComponent(parts[parts.length - 1] ?? "");
					if (!imageFilePattern.test(filename)) {
						sendJson(res, 404, { error: "Image not found." });
						return;
					}

					const file = await readStoryImage(filename);
					res.statusCode = 200;
					res.setHeader("Content-Type", "image/webp");
					res.setHeader("Cache-Control", "no-store");
					res.end(file);
				} catch {
					sendJson(res, 404, { error: "Image not found." });
				}
			});
		},
	};
}
