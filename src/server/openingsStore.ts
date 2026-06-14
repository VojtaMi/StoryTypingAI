import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type OpenAI from "openai";
import { type Genre, type GenreId, genres } from "../genres";
import type { StoryBackgroundImage } from "../storyBackground";
import { completeAi } from "./aiService";

const openingsDir = join(process.cwd(), "openings");
const storyImagesDir = join(process.cwd(), "story-images");

export const imageFilePattern = /^[a-zA-Z0-9_-]+\.webp$/;

interface PreparedOpening extends Partial<StoryBackgroundImage> {
	genreId: GenreId;
	text: string;
	messages: Array<{
		role: "system" | "user" | "assistant";
		content: string;
	}>;
	createdAt: string;
}

export async function listPreparedOpenings() {
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

export async function prepareMissingOpenings(openai: OpenAI) {
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

export async function consumePreparedOpening(
	genreId: GenreId,
): Promise<PreparedOpening | null> {
	const opening = await readPreparedOpening(genreId);
	if (!opening) return null;
	await rm(openingPath(genreId), { force: true });
	return opening;
}

export async function readStoryImage(filename: string) {
	return readFile(join(storyImagesDir, filename));
}

export function findGenre(genreId: string): Genre | undefined {
	return genres.find((genre) => genre.id === genreId);
}

async function createPreparedOpening(
	openai: OpenAI,
	genre: Genre,
): Promise<PreparedOpening> {
	const messages: PreparedOpening["messages"] = [
		{ role: "system", content: genre.systemPrompt },
		{ role: "user", content: "Begin the story." },
	];
	const text = await completeAi(openai, messages);
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

function openingPath(genreId: GenreId) {
	return join(openingsDir, `${genreId}.json`);
}

function fallbackBackgroundUrl(genreId: GenreId) {
	return `/images/fallback-${genreId}.webp`;
}
