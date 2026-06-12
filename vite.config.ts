import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import OpenAI from "openai";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { type Genre, type GenreId, genres } from "./src/genres";

const savesDir = join(process.cwd(), "saves");
const openingsDir = join(process.cwd(), "openings");
const saveIdPattern = /^[a-zA-Z0-9_-]+$/;

function savesApi(): Plugin {
	return {
		name: "local-json-saves-api",
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				if (!req.url?.startsWith("/api/saves")) {
					next();
					return;
				}

				try {
					const url = new URL(req.url, "http://localhost");
					const parts = url.pathname.split("/").filter(Boolean);
					const id = parts[2];

					if (parts.length === 2 && req.method === "GET") {
						const saves = await listSaves();
						sendJson(res, 200, saves);
						return;
					}

					if (parts.length !== 3 || !id || !saveIdPattern.test(id)) {
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
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					sendJson(res, 500, { error: message });
				}
			});
		},
	};
}

async function listSaves() {
	await mkdir(savesDir, { recursive: true });
	const names = await readdir(savesDir);
	const saves = await Promise.all(
		names
			.filter((name) => name.endsWith(".json"))
			.map(async (name) => {
				const id = name.slice(0, -".json".length);
				return readSave(id);
			}),
	);

	return saves
		.filter((save) => save !== null)
		.map((save) => {
			const latestText =
				save.currentTarget ??
				save.segments.at(-1)?.text ??
				save.messages.at(-1)?.content ??
				"";
			return {
				id: save.id,
				genreId: save.genreId,
				title: save.title,
				updatedAt: save.updatedAt,
				preview: latestText.slice(0, 180),
			};
		})
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function readSave(id: string) {
	try {
		const text = await readFile(savePath(id), "utf8");
		return JSON.parse(text);
	} catch {
		return null;
	}
}

async function writeSave(id: string, save: unknown) {
	await mkdir(savesDir, { recursive: true });
	await writeFile(savePath(id), `${JSON.stringify(save, null, 2)}\n`, "utf8");
}

async function deleteSave(id: string) {
	await rm(savePath(id), { force: true });
}

function savePath(id: string) {
	return join(savesDir, `${id}.json`);
}

interface PreparedOpening {
	genreId: GenreId;
	text: string;
	messages: Array<{
		role: "system" | "user" | "assistant";
		content: string;
	}>;
	createdAt: string;
}

function openingsApi(apiKey: string): Plugin {
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
						preparePromise ??= prepareMissingOpenings(openai).finally(() => {
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

async function listPreparedOpenings() {
	await mkdir(openingsDir, { recursive: true });
	const openings = await Promise.all(
		genres.map(async (genre) => readPreparedOpening(genre.id)),
	);

	return openings
		.filter((opening) => opening !== null)
		.map((opening) => ({
			genreId: opening.genreId,
			createdAt: opening.createdAt,
		}));
}

async function prepareMissingOpenings(openai: OpenAI) {
	await mkdir(openingsDir, { recursive: true });

	for (const genre of genres) {
		const existing = await readPreparedOpening(genre.id);
		if (existing) continue;

		const opening = await createPreparedOpening(openai, genre);
		await writePreparedOpening(opening);
	}
}

async function createPreparedOpening(
	openai: OpenAI,
	genre: Genre,
): Promise<PreparedOpening> {
	const messages: PreparedOpening["messages"] = [
		{ role: "system", content: genre.systemPrompt },
		{ role: "user", content: "Begin the story." },
	];
	const response = await openai.chat.completions.create({
		model: "gpt-4o-mini",
		max_tokens: 150,
		messages,
	});
	const raw = response.choices[0]?.message?.content?.trim();
	if (!raw) throw new Error("The AI returned an empty response.");

	const text = normalize(raw);
	return {
		genreId: genre.id,
		text,
		messages: [...messages, { role: "assistant", content: text }],
		createdAt: new Date().toISOString(),
	};
}

async function readPreparedOpening(
	genreId: GenreId,
): Promise<PreparedOpening | null> {
	try {
		const text = await readFile(openingPath(genreId), "utf8");
		return JSON.parse(text);
	} catch {
		return null;
	}
}

async function writePreparedOpening(opening: PreparedOpening) {
	await mkdir(openingsDir, { recursive: true });
	await writeFile(
		openingPath(opening.genreId),
		`${JSON.stringify(opening, null, 2)}\n`,
		"utf8",
	);
}

async function consumePreparedOpening(
	genreId: GenreId,
): Promise<PreparedOpening | null> {
	const opening = await readPreparedOpening(genreId);
	if (!opening) return null;
	await rm(openingPath(genreId), { force: true });
	return opening;
}

function openingPath(genreId: GenreId) {
	return join(openingsDir, `${genreId}.json`);
}

function findGenre(genreId: GenreId) {
	return genres.find((genre) => genre.id === genreId);
}

async function readBody(req: IncomingMessage) {
	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
	res.statusCode = statusCode;
	if (body === null && statusCode === 204) {
		res.end();
		return;
	}
	res.setHeader("Content-Type", "application/json");
	res.end(JSON.stringify(body));
}

function normalize(text: string): string {
	return text
		.replace(/[''‚‛]/g, "'")
		.replace(/[""„‟]/g, '"')
		.replace(/–/g, "-")
		.replace(/—/g, "--")
		.replace(/…/g, "...");
}

function aiApi(apiKey: string): Plugin {
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
					sendJson(res, 200, { text: normalize(raw) });
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					sendJson(res, 500, { error: message });
				}
			});
		},
	};
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	return {
		plugins: [
			react(),
			savesApi(),
			openingsApi(env.OPENAI_API_KEY),
			aiApi(env.OPENAI_API_KEY),
		],
	};
});
