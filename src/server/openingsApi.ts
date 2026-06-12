import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import OpenAI from "openai";
import type { Plugin } from "vite";
import { type Genre, type GenreId, genres } from "../genres";
import type { StoryBackgroundImage } from "../storyBackground";
import { normalizeStoryText, sendJson } from "./http";

const openingsDir = join(process.cwd(), "openings");
const storyImagesDir = join(process.cwd(), "story-images");

interface PreparedOpening extends Partial<StoryBackgroundImage> {
	genreId: GenreId;
	text: string;
	messages: Array<{
		role: "system" | "user" | "assistant";
		content: string;
	}>;
	createdAt: string;
}

const imageFilePattern = /^[a-zA-Z0-9_-]+\.webp$/;

export function openingsApi(apiKey: string): Plugin {
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
		if (existing) {
			if (existing.backgroundImageUrl) continue;
			await writePreparedOpening({
				...existing,
				...(await createBackgroundImage(openai, genre, existing.text)),
			});
			continue;
		}

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

	const text = normalizeStoryText(raw);
	return {
		genreId: genre.id,
		text,
		messages: [...messages, { role: "assistant", content: text }],
		...(await createBackgroundImage(openai, genre, text)),
		createdAt: new Date().toISOString(),
	};
}

async function createBackgroundImage(
	openai: OpenAI,
	genre: Genre,
	openingText: string,
): Promise<StoryBackgroundImage> {
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
		const filename = `${genre.id}-${Date.now()}-${Math.random()
			.toString(36)
			.slice(2)}.webp`;
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
			backgroundImageUrl: fallbackBackgroundUrl(genre.id),
			backgroundImagePrompt: prompt,
			backgroundImageSource: "fallback",
		};
	}
}

function buildBackgroundPrompt(genre: Genre, openingText: string) {
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

					const file = await readFile(join(storyImagesDir, filename));
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

function fallbackBackgroundUrl(genreId: GenreId) {
	return `/images/fallback-${genreId}.webp`;
}
