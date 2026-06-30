import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type OpenAI from "openai";
import { type Genre, type GenreId, genres } from "../genres";
import { DEFAULT_TEXT_MODEL } from "../models";
import {
	isNarrationVoiceId,
	type NarrationVoiceId,
	pickRandomNarrationVoice,
} from "../narrationVoice";
import {
	type ChatMessage,
	generateReadingFrame,
	type ReadingStoryFrame,
	readingPartMessages,
} from "../story";
import type { StoryOpeningAudio } from "../storyAudio";
import type { StoryBackgroundImage } from "../storyBackground";
import { completeAi } from "./aiService";
import { createOpeningAudio } from "./storyAudioStore";
import {
	bundledImagesPath,
	bundleIdPattern,
	createBundleId,
	pathExists,
} from "./storyBundleStore";

const openingsDir = join(process.cwd(), "openings");
const readingOpeningsDir = join(process.cwd(), "reading-openings");
const storyImagesDir = join(process.cwd(), "story-images");

export const imageFilePattern = /^[a-zA-Z0-9_-]+\.webp$/;

interface PreparedOpening
	extends Partial<StoryBackgroundImage>,
		Partial<StoryOpeningAudio> {
	id: string;
	genreId: GenreId;
	text: string;
	backgroundIntro?: string;
	narrationVoice?: NarrationVoiceId;
	messages: Array<{
		role: "system" | "user" | "assistant";
		content: string;
	}>;
	createdAt: string;
}

interface PreparedReadingOpening
	extends Partial<StoryBackgroundImage>,
		Partial<StoryOpeningAudio> {
	id: string;
	genreId: GenreId;
	text: string;
	messages: ChatMessage[];
	readingFrame: ReadingStoryFrame;
	readingPartIndex: number;
	narrationVoice: NarrationVoiceId;
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

export async function listPreparedReadingOpenings() {
	await mkdir(readingOpeningsDir, { recursive: true });
	const openings = await Promise.all(
		genres.map(async (genre) => readPreparedReadingOpening(genre.id)),
	);

	return openings
		.filter((opening) => opening !== null)
		.map((opening) => ({
			genreId: opening.genreId,
			createdAt: opening.createdAt,
		}));
}

export async function prepareMissingOpenings(
	openai: OpenAI,
	model = DEFAULT_TEXT_MODEL,
	anthropicKey = "",
) {
	await mkdir(openingsDir, { recursive: true });

	for (const genre of genres) {
		const existing = await readPreparedOpening(genre.id);
		if (existing) {
			const id =
				existing.id ?? createBundleId(`${genre.label} story`, randomUUID());
			const next: PreparedOpening = {
				...existing,
				id,
			};
			let changed = existing.id !== id;
			const narrationVoice = isNarrationVoiceId(existing.narrationVoice)
				? existing.narrationVoice
				: pickRandomNarrationVoice();
			if (next.narrationVoice !== narrationVoice) {
				next.narrationVoice = narrationVoice;
				changed = true;
			}
			if (!existing.backgroundImageUrl) {
				Object.assign(
					next,
					await createBackgroundImage(openai, genre, existing.text, id, {
						sectionIndex: 1,
					}),
				);
				changed = true;
			}
			if (
				!existing.openingAudioUrl ||
				existing.openingAudioVoice !== narrationVoice
			) {
				Object.assign(
					next,
					(await createOpeningAudio(openai, existing.text, id, narrationVoice, {
						sectionIndex: 1,
					})) ?? {},
				);
				changed = true;
			}
			if (changed) await writePreparedOpening(next);
			continue;
		}

		const opening = await createPreparedOpening(
			openai,
			genre,
			model,
			anthropicKey,
		);
		await writePreparedOpening(opening);
	}
}

export async function prepareMissingReadingOpenings(
	openai: OpenAI,
	model = DEFAULT_TEXT_MODEL,
	anthropicKey = "",
) {
	await mkdir(readingOpeningsDir, { recursive: true });

	for (const genre of genres) {
		const existing = await readPreparedReadingOpening(genre.id);
		if (existing) {
			let changed = false;
			const next: PreparedReadingOpening = { ...existing };
			const narrationVoice = isNarrationVoiceId(existing.narrationVoice)
				? existing.narrationVoice
				: pickRandomNarrationVoice();
			if (next.narrationVoice !== narrationVoice) {
				next.narrationVoice = narrationVoice;
				changed = true;
			}
			if (
				!existing.openingAudioUrl ||
				existing.openingAudioVoice !== narrationVoice
			) {
				Object.assign(
					next,
					(await createOpeningAudio(
						openai,
						existing.text,
						existing.id,
						narrationVoice,
						{ sectionIndex: 1 },
					)) ?? {},
				);
				changed = true;
			}
			if (!existing.backgroundImageUrl) {
				Object.assign(
					next,
					await createBackgroundImage(
						openai,
						genre,
						existing.text,
						existing.id,
						{ sectionIndex: 1 },
					),
				);
				changed = true;
			}
			if (changed) await writePreparedReadingOpening(next);
			continue;
		}

		const opening = await createPreparedReadingOpening(
			openai,
			genre,
			model,
			anthropicKey,
		);
		await writePreparedReadingOpening(opening);
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

export async function consumePreparedReadingOpening(
	genreId: GenreId,
): Promise<PreparedReadingOpening | null> {
	const opening = await readPreparedReadingOpening(genreId);
	if (!opening) return null;
	await rm(readingOpeningPath(genreId), { force: true });
	return opening;
}

export async function readStoryImage(relativePath: string) {
	const [storyId, filename] = relativePath.split("/");
	if (storyId && filename) {
		const bundled = bundledImagesPath(storyId, filename);
		if (await pathExists(bundled)) return readFile(bundled);
	}
	return readFile(join(storyImagesDir, relativePath));
}

export async function listStoryImages(storyId: string): Promise<string[]> {
	const bundledFolder = join(process.cwd(), "stories", storyId, "images");
	const legacyFolder = join(storyImagesDir, storyId);
	try {
		const files = [
			...(await readdir(bundledFolder).catch(() => [])),
			...(await readdir(legacyFolder).catch(() => [])),
		];
		return [...new Set(files)]
			.filter((f) => imageFilePattern.test(f))
			.sort()
			.map((f) => `/api/story-images/${storyId}/${f}`);
	} catch {
		return [];
	}
}

export function findGenre(genreId: string): Genre | undefined {
	return genres.find((genre) => genre.id === genreId);
}

async function createPreparedOpening(
	openai: OpenAI,
	genre: Genre,
	model = DEFAULT_TEXT_MODEL,
	anthropicKey = "",
): Promise<PreparedOpening> {
	const id = createBundleId(`${genre.label} story`, randomUUID());
	const seed = genre.seeds[Math.floor(Math.random() * genre.seeds.length)];
	const userContent = seed
		? `Begin the story. Seed element: ${seed}.`
		: "Begin the story.";
	const messages: PreparedOpening["messages"] = [
		{ role: "system", content: genre.systemPrompt },
		{ role: "user", content: userContent },
	];
	const text = await completeAi(openai, messages, 200, model, anthropicKey);
	const narrationVoice = pickRandomNarrationVoice();
	const [backgroundIntro, backgroundImage, openingAudio] = await Promise.all([
		createBackgroundIntro(openai, genre, text, model, anthropicKey),
		createBackgroundImage(openai, genre, text, id, { sectionIndex: 1 }),
		createOpeningAudio(openai, text, id, narrationVoice, { sectionIndex: 1 }),
	]);
	return {
		id,
		genreId: genre.id,
		text,
		backgroundIntro,
		narrationVoice,
		messages: [...messages, { role: "assistant", content: text }],
		...backgroundImage,
		...(openingAudio ?? {}),
		createdAt: new Date().toISOString(),
	};
}

async function createPreparedReadingOpening(
	openai: OpenAI,
	genre: Genre,
	model = DEFAULT_TEXT_MODEL,
	anthropicKey = "",
): Promise<PreparedReadingOpening> {
	const id = createBundleId(`${genre.label} story`, randomUUID());
	const complete = (messages: ChatMessage[], maxTokens: number) =>
		completeAi(openai, messages, maxTokens, model, anthropicKey);
	const readingFrame = await generateReadingFrame(complete, genre);
	const text = await complete(readingPartMessages(readingFrame, 1, []), 260);
	const messages: ChatMessage[] = [
		{ role: "system", content: genre.systemPrompt },
		{
			role: "user",
			content: `Six-part beginner reading story frame:\n${JSON.stringify(
				readingFrame,
				null,
				2,
			)}`,
		},
		{ role: "assistant", content: text },
	];
	const narrationVoice = pickRandomNarrationVoice();
	const [backgroundImage, openingAudio] = await Promise.all([
		createBackgroundImage(openai, genre, text, id, { sectionIndex: 1 }),
		createOpeningAudio(openai, text, id, narrationVoice, { sectionIndex: 1 }),
	]);
	return {
		id,
		genreId: genre.id,
		text,
		messages,
		readingFrame,
		readingPartIndex: 1,
		narrationVoice,
		...backgroundImage,
		...(openingAudio ?? {}),
		createdAt: new Date().toISOString(),
	};
}

async function createBackgroundIntro(
	openai: OpenAI,
	genre: Genre,
	openingText: string,
	model = DEFAULT_TEXT_MODEL,
	anthropicKey = "",
): Promise<string> {
	try {
		return await completeAi(
			openai,
			[
				{
					role: "system",
					content:
						"Write a 1-2 sentence second-person character introduction for an interactive story. " +
						"State concretely who the player character is and what brought them to this place. " +
						"Write in English, even if the story opening is in another language. " +
						"Start with 'You'. Output only the introduction — no quotes, no headings.",
				},
				{
					role: "user",
					content: `${genre.label} story opening:\n${openingText}`,
				},
			],
			100,
			model,
			anthropicKey,
		);
	} catch (err) {
		console.warn("Could not generate background intro.", err);
		return "";
	}
}

export async function createBackgroundImage(
	openai: OpenAI,
	genre: Genre,
	storyText: string,
	storyId: string,
	options: { sectionIndex?: number } = {},
): Promise<StoryBackgroundImage> {
	const prompt = buildBackgroundPrompt(genre, storyText);
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

		const filename = imageFilename(genre, options.sectionIndex);
		const filePath = imagePath(storyId, filename);
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, Buffer.from(encoded, "base64"));
		return {
			backgroundImageUrl: `/api/story-images/${storyId}/${filename}`,
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

async function readPreparedReadingOpening(
	genreId: GenreId,
): Promise<PreparedReadingOpening | null> {
	try {
		const text = await readFile(readingOpeningPath(genreId), "utf8");
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

async function writePreparedReadingOpening(opening: PreparedReadingOpening) {
	await mkdir(readingOpeningsDir, { recursive: true });
	await writeFile(
		readingOpeningPath(opening.genreId),
		`${JSON.stringify(opening, null, 2)}\n`,
		"utf8",
	);
}

function openingPath(genreId: GenreId) {
	return join(openingsDir, `${genreId}.json`);
}

function readingOpeningPath(genreId: GenreId) {
	return join(readingOpeningsDir, `${genreId}.json`);
}

function fallbackBackgroundUrl(genreId: GenreId) {
	return `/images/fallback-${genreId}.webp`;
}

function imageFilename(genre: Genre, sectionIndex?: number) {
	if (sectionIndex !== undefined) return `section_${sectionIndex}.webp`;
	return `${genre.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
}

function imagePath(storyId: string, filename: string) {
	if (bundleIdPattern.test(storyId))
		return bundledImagesPath(storyId, filename);
	return join(storyImagesDir, storyId, filename);
}
