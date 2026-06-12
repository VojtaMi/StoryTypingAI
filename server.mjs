import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 80;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

const distDir = join(__dirname, "dist");
const openingsDir = join(__dirname, "openings");
const storyImagesDir = join(__dirname, "story-images");
const savesDir = join(__dirname, "saves");

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ── Genres ────────────────────────────────────────────────────────────────────

const sharedStyleGuide =
	"You are a collaborative storyteller co-writing an interactive story with the user. " +
	"Write vivid, immersive prose in short segments of 2 to 4 sentences. " +
	"The user adds their own continuations; build on them naturally and keep the story coherent. " +
	"Output only the story prose — no titles, headings, meta-commentary, or instructions to the user.";

const genres = [
	{
		id: "fantasy",
		label: "Fantasy",
		systemPrompt: `${sharedStyleGuide} The genre is high fantasy: magic, mythical creatures, ancient kingdoms, and epic quests.`,
	},
	{
		id: "scifi",
		label: "Sci-Fi",
		systemPrompt: `${sharedStyleGuide} The genre is science fiction: distant futures, starships, advanced technology, and the unknown reaches of space.`,
	},
	{
		id: "horror",
		label: "Horror",
		systemPrompt: `${sharedStyleGuide} The genre is horror: dread, the uncanny, creeping tension, and things that should not be. Keep it unsettling but not gratuitously graphic.`,
	},
];

const genreIds = new Set(genres.map((g) => g.id));

// ── Utilities ─────────────────────────────────────────────────────────────────

async function readBody(req) {
	const chunks = [];
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res, statusCode, body) {
	res.statusCode = statusCode;
	if (body === null && statusCode === 204) {
		res.end();
		return;
	}
	res.setHeader("Content-Type", "application/json");
	res.end(JSON.stringify(body));
}

function normalizeStoryText(text) {
	return text
		.replace(/[''‚‛]/g, "'")
		.replace(/[""„‟]/g, '"')
		.replace(/–/g, "-")
		.replace(/—/g, "--")
		.replace(/…/g, "...");
}

// ── Openings API ──────────────────────────────────────────────────────────────

const imageFilePattern = /^[a-zA-Z0-9_-]+\.webp$/;
const saveIdPattern = /^[a-zA-Z0-9_-]+$/;

let preparePromise = null;

function openingPath(genreId) {
	return join(openingsDir, `${genreId}.json`);
}

async function readPreparedOpening(genreId) {
	try {
		const text = await readFile(openingPath(genreId), "utf8");
		return JSON.parse(text);
	} catch {
		return null;
	}
}

async function writePreparedOpening(opening) {
	await mkdir(openingsDir, { recursive: true });
	await writeFile(
		openingPath(opening.genreId),
		`${JSON.stringify(opening, null, 2)}\n`,
		"utf8",
	);
}

async function consumePreparedOpening(genreId) {
	const opening = await readPreparedOpening(genreId);
	if (!opening) return null;
	await rm(openingPath(genreId), { force: true });
	return opening;
}

async function listPreparedOpenings() {
	await mkdir(openingsDir, { recursive: true });
	const openings = await Promise.all(
		genres.map((g) => readPreparedOpening(g.id)),
	);
	return openings
		.filter((o) => o !== null)
		.map((o) => ({ genreId: o.genreId, createdAt: o.createdAt }));
}

function buildBackgroundPrompt(genre, openingText) {
	return [
		"Create a cinematic full-page background image for a typing story app.",
		`Genre: ${genre.label}.`,
		`Story opening: ${openingText}`,
		"Use a 3:2 landscape composition suitable for a 1536x1024 desktop background.",
		"Make the scene feel specific to the opening while preserving room for imagination.",
		"Keep the center area moderately low contrast so a translucent text panel remains readable.",
		"Put brighter highlights and intricate details toward the edges rather than behind the central text.",
		"No text, letters, logos, signage, UI, watermark, signature, or captions.",
	].join("\n");
}

async function createBackgroundImage(genre, openingText) {
	const prompt = buildBackgroundPrompt(genre, openingText);
	try {
		const response = await openai.images.generate({
			model: "gpt-image-2",
			prompt,
			size: "1536x1024",
			quality: "low",
			output_format: "webp",
			n: 1,
		});
		const encoded = response.data?.[0]?.b64_json;
		if (!encoded) throw new Error("The image API returned no image data.");

		await mkdir(storyImagesDir, { recursive: true });
		const filename = `${genre.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
		await writeFile(
			join(storyImagesDir, filename),
			Buffer.from(encoded, "base64"),
		);
		return {
			backgroundImageUrl: `/api/story-images/${filename}`,
			backgroundImagePrompt: prompt,
			backgroundImageSource: "generated",
		};
	} catch (err) {
		console.warn(`Could not generate ${genre.label} background image.`, err);
		return {
			backgroundImageUrl: `/images/fallback-${genre.id}.webp`,
			backgroundImagePrompt: prompt,
			backgroundImageSource: "fallback",
		};
	}
}

async function createPreparedOpening(genre) {
	const messages = [
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

	const text = normalizeStoryText(raw);
	return {
		genreId: genre.id,
		text,
		messages: [...messages, { role: "assistant", content: text }],
		...(await createBackgroundImage(genre, text)),
		createdAt: new Date().toISOString(),
	};
}

async function prepareMissingOpenings() {
	await mkdir(openingsDir, { recursive: true });
	for (const genre of genres) {
		const existing = await readPreparedOpening(genre.id);
		if (existing) {
			if (existing.backgroundImageUrl) continue;
			await writePreparedOpening({
				...existing,
				...(await createBackgroundImage(genre, existing.text)),
			});
			continue;
		}
		const opening = await createPreparedOpening(genre);
		await writePreparedOpening(opening);
	}
}

// ── Saves API ─────────────────────────────────────────────────────────────────

function savePath(id) {
	return join(savesDir, `${id}.json`);
}

async function readSave(id) {
	try {
		const text = await readFile(savePath(id), "utf8");
		return JSON.parse(text);
	} catch {
		return null;
	}
}

async function writeSave(id, save) {
	await mkdir(savesDir, { recursive: true });
	await writeFile(savePath(id), `${JSON.stringify(save, null, 2)}\n`, "utf8");
}

async function deleteSave(id) {
	await rm(savePath(id), { force: true });
}

async function listSaves() {
	await mkdir(savesDir, { recursive: true });
	const names = await readdir(savesDir);
	const saves = await Promise.all(
		names
			.filter((name) => name.endsWith(".json"))
			.map(async (name) => readSave(name.slice(0, -".json".length))),
	);
	return saves
		.filter((s) => s !== null)
		.map((s) => {
			const latestText =
				s.currentTarget ??
				s.segments?.at(-1)?.text ??
				s.messages?.at(-1)?.content ??
				"";
			return {
				id: s.id,
				genreId: s.genreId,
				title: s.title,
				updatedAt: s.updatedAt,
				preview: latestText.slice(0, 180),
			};
		})
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// ── Static file serving ───────────────────────────────────────────────────────

const mimeTypes = {
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

async function serveStatic(res, urlPath) {
	// Resolve to a file in dist/
	const filePath = join(distDir, urlPath === "/" ? "index.html" : urlPath);
	try {
		const content = await readFile(filePath);
		const mime = mimeTypes[extname(filePath)] ?? "application/octet-stream";
		res.setHeader("Content-Type", mime);
		res.statusCode = 200;
		res.end(content);
	} catch {
		// SPA fallback: serve index.html for unknown paths
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

// ── Request handler ───────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
	const url = new URL(req.url ?? "/", `http://localhost`);
	const pathname = url.pathname;
	const parts = pathname.split("/").filter(Boolean);

	try {
		// GET /api/openings
		if (pathname === "/api/openings" && req.method === "GET") {
			sendJson(res, 200, await listPreparedOpenings());
			return;
		}

		// POST /api/openings/prepare
		if (pathname === "/api/openings/prepare" && req.method === "POST") {
			preparePromise ??= prepareMissingOpenings().finally(() => {
				preparePromise = null;
			});
			await preparePromise;
			sendJson(res, 200, await listPreparedOpenings());
			return;
		}

		// POST /api/openings/:genreId/consume
		if (
			parts.length === 4 &&
			parts[0] === "api" &&
			parts[1] === "openings" &&
			parts[3] === "consume" &&
			req.method === "POST"
		) {
			const genreId = parts[2];
			if (!genreIds.has(genreId)) {
				sendJson(res, 404, { error: "Genre not found." });
				return;
			}
			sendJson(res, 200, await consumePreparedOpening(genreId));
			return;
		}

		// GET /api/story-images/:filename
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
				const file = await readFile(join(storyImagesDir, filename));
				res.statusCode = 200;
				res.setHeader("Content-Type", "image/webp");
				res.setHeader("Cache-Control", "no-store");
				res.end(file);
			} catch {
				sendJson(res, 404, { error: "Image not found." });
			}
			return;
		}

		// GET /api/saves
		if (pathname === "/api/saves" && req.method === "GET") {
			sendJson(res, 200, await listSaves());
			return;
		}

		// /api/saves/:id
		if (parts.length === 3 && parts[0] === "api" && parts[1] === "saves") {
			const id = parts[2];
			if (!saveIdPattern.test(id)) {
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

		// POST /api/ai/complete
		if (pathname === "/api/ai/complete" && req.method === "POST") {
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
			return;
		}

		// Static files
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
