import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type OpenAI from "openai";
import sharp from "sharp";
import { type Genre, type GenreId, genres } from "../genres";
import { DEFAULT_TEXT_MODEL, type TextReasoningEffort } from "../models";
import {
	isNarrationVoiceId,
	type NarrationVoiceId,
	pickRandomNarrationVoice,
} from "../narrationVoice";
import {
	type ChatMessage,
	generateReadingStory,
	generateTitle,
	READING_STORY_TOTAL_PARTS,
	type ReadingStory,
	readingImagePrompt,
	readingStoryMessages,
	readingVisualContext,
} from "../story";
import type { StoryOpeningAudio } from "../storyAudio";
import type { StoryBackgroundImage } from "../storyBackground";
import { normalizeStoryText } from "../storyText";
import { storyWords } from "../storyVocabulary";
import { DEFAULT_TTS_MODEL, type TtsModelId } from "../ttsModel";
import { completeAi, completeStructuredAi, translateWords } from "./aiService";
import { buildStoryBackgroundPrompt, generateStoryImage } from "./images";
import { readLearnerContext } from "./learnerProfileStore";
import { createOpeningAudio } from "./storyAudioStore";
import {
	bundledImagesPath,
	bundleIdPattern,
	createBundleId,
	pathExists,
} from "./storyBundleStore";
import { readFinishEvidence } from "./storyFinishEvidenceStore";

const openingsDir = join(process.cwd(), "openings");
const readingOpeningsDir = join(process.cwd(), "reading-openings");
const storyImagesDir = join(process.cwd(), "story-images");

export const imageFilePattern = /^[a-zA-Z0-9_-]+\.(jpe?g|png|webp)$/;

interface PreparedOpening
	extends Partial<StoryBackgroundImage>,
		Partial<StoryOpeningAudio> {
	id: string;
	genreId: GenreId;
	title?: string;
	text: string;
	backgroundIntro?: string;
	narrationVoice?: NarrationVoiceId;
	messages: ChatMessage[];
	createdAt: string;
}

/**
 * The single queued reading story. It holds the whole generated story, so
 * starting it costs no text generation; `text` and the media fields are part 1,
 * prepared ahead so the first screen appears immediately.
 */
interface PreparedReadingOpening
	extends Partial<StoryBackgroundImage>,
		Partial<StoryOpeningAudio> {
	id: string;
	genreId: GenreId;
	title?: string;
	text: string;
	messages: ChatMessage[];
	readingStory: ReadingStory;
	/** Contextual glosses for every story word, generated once at prepare time. */
	wordTranslations: Record<string, string>;
	readingPartIndex: number;
	narrationVoice: NarrationVoiceId;
	createdAt: string;
	/**
	 * The finished story this was prepared after finalizing, or `null` for the
	 * very first story. Compared against the id the caller is preparing for so a
	 * queued entry generated before the latest finalization is never handed out.
	 */
	basedOnStoryId: string | null;
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
		try {
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
						(await createOpeningAudio(
							openai,
							existing.text,
							id,
							narrationVoice,
							{
								sectionIndex: 1,
							},
						)) ?? {},
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
		} catch (err) {
			console.warn(`Could not prepare ${genre.label} story opening.`, err);
		}
	}
}

export async function prepareMissingReadingOpenings(
	openai: OpenAI,
	model = DEFAULT_TEXT_MODEL,
	anthropicKey = "",
	basedOnStoryId: string | null = null,
	nextTheme?: string,
	reasoningEffort: TextReasoningEffort = "low",
	ttsModel: TtsModelId = DEFAULT_TTS_MODEL,
) {
	await mkdir(readingOpeningsDir, { recursive: true });

	for (const genre of genres) {
		try {
			const existing = await readPreparedReadingOpening(genre.id);
			if (existing && existing.basedOnStoryId !== basedOnStoryId) {
				// Stale relative to the finalization this call follows: it was
				// generated against learner state finalization has since replaced.
				// The queue is a cache, not history — discard it and generate fresh.
				await rm(readingOpeningPath(genre.id), { force: true });
			} else if (existing) {
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
							{ sectionIndex: 1, ttsModel },
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
							readingImagePrompt(existing.readingStory, 1),
							existing.id,
							{
								sectionIndex: 1,
								visualContext: readingVisualContext(existing.readingStory),
							},
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
				basedOnStoryId,
				nextTheme,
				reasoningEffort,
				ttsModel,
			);
			await writePreparedReadingOpening(opening);
		} catch (err) {
			console.warn(`Could not prepare ${genre.label} reading opening.`, err);
		}
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

async function titleFromText(
	openai: OpenAI,
	text: string,
	fallback: string,
	model = DEFAULT_TEXT_MODEL,
	anthropicKey = "",
) {
	try {
		const title = await generateTitle(
			(messages, maxTokens) =>
				completeAi(openai, messages, maxTokens, model, anthropicKey),
			text,
		);
		return title || fallback;
	} catch (err) {
		console.warn("Could not generate prepared story title.", err);
		return fallback;
	}
}

async function createPreparedOpening(
	openai: OpenAI,
	genre: Genre,
	model = DEFAULT_TEXT_MODEL,
	anthropicKey = "",
): Promise<PreparedOpening> {
	const seed = genre.seeds[Math.floor(Math.random() * genre.seeds.length)];
	const userContent = seed
		? `Begin the story. Seed element: ${seed}.`
		: "Begin the story.";
	const messages: PreparedOpening["messages"] = [
		{ role: "system", content: genre.systemPrompt },
		{ role: "user", content: userContent },
	];
	const text = normalizeStoryText(
		await completeAi(openai, messages, 200, model, anthropicKey),
	);
	const title = await titleFromText(
		openai,
		text,
		`${genre.label} Story`,
		model,
		anthropicKey,
	);
	const id = createBundleId(title, randomUUID());
	const narrationVoice = pickRandomNarrationVoice();
	const [backgroundIntro, backgroundImage, openingAudio] = await Promise.all([
		createBackgroundIntro(openai, genre, text, model, anthropicKey),
		createBackgroundImage(openai, genre, text, id, { sectionIndex: 1 }),
		createOpeningAudio(openai, text, id, narrationVoice, { sectionIndex: 1 }),
	]);
	return {
		id,
		genreId: genre.id,
		title,
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
	basedOnStoryId: string | null = null,
	nextTheme?: string,
	reasoningEffort: TextReasoningEffort = "low",
	ttsModel: TtsModelId = DEFAULT_TTS_MODEL,
): Promise<PreparedReadingOpening> {
	const learnerContext = await readLearnerContext();
	// The transient reading-chain hint the finished story produced. It lives in
	// that story's finish-evidence record and hard-overrides this story's focus.
	const chainHint = basedOnStoryId
		? ((await readFinishEvidence(basedOnStoryId)).readingChain ?? undefined)
		: undefined;
	const readingStory = await generateReadingStory(
		(messages, maxTokens, options) =>
			completeStructuredAi(
				openai,
				messages,
				maxTokens,
				options?.model ?? model,
				anthropicKey,
				options,
			),
		genre,
		learnerContext,
		nextTheme,
		{ reasoningEffort, chainHint },
	);
	const text = readingStory.parts[0].text;
	const title = readingStory.title;
	const id = createBundleId(title, randomUUID());
	const narrationVoice = pickRandomNarrationVoice();
	const [backgroundImage, openingAudio, wordTranslations] = await Promise.all([
		createBackgroundImage(
			openai,
			genre,
			readingImagePrompt(readingStory, 1),
			id,
			{
				sectionIndex: 1,
				visualContext: readingVisualContext(readingStory),
			},
		),
		createOpeningAudio(openai, text, id, narrationVoice, {
			sectionIndex: 1,
			ttsModel,
		}),
		prewarmReadingTranslations(openai, readingStory),
	]);
	return {
		id,
		genreId: genre.id,
		title,
		text,
		messages: readingStoryMessages(genre, readingStory, 1),
		readingStory,
		readingPartIndex: 1,
		narrationVoice,
		wordTranslations,
		...backgroundImage,
		...(openingAudio ?? {}),
		createdAt: new Date().toISOString(),
		basedOnStoryId,
	};
}

async function prewarmReadingTranslations(
	openai: OpenAI,
	readingStory: ReadingStory,
): Promise<Record<string, string>> {
	try {
		const partTexts = readingStory.parts.map((part) => part.text);
		const words = storyWords(partTexts, readingStory.characterNames);
		if (words.length === 0) return {};
		return await translateWords(openai, words, partTexts.join("\n"));
	} catch (err) {
		console.warn("Could not prewarm reading-story translations.", err);
		return {};
	}
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

const backgroundImagesInFlight = new Map<
	string,
	Promise<StoryBackgroundImage>
>();

interface BackgroundImageOptions {
	sectionIndex?: number;
	visualContext?: string;
	/**
	 * Attach section 1's image to this request. Every later section anchors to
	 * that one frame rather than to the section before it, so a drifting face or
	 * costume cannot compound across the story.
	 */
	anchorToFirstSection?: boolean;
}

/**
 * The anchor only has to carry identity — faces, clothing, creature design — not
 * detail, so it is sent at half size. Image input is billed per token and scales
 * with dimensions: 768x512 costs 704 tokens against 1536 for the full frame,
 * about a third off an anchored image, with no measurable loss of likeness.
 */
const ANCHOR_WIDTH = 768;
const ANCHOR_HEIGHT = 512;

/**
 * Deliberately high: image input is billed by dimensions, not by file size, so
 * compressing the anchor harder saves nothing and only degrades the likeness it
 * exists to carry.
 */
const ANCHOR_QUALITY = 90;

/** Section 1's generated image, or null when there is nothing to anchor to. */
async function readAnchorImage(storyId: string): Promise<Buffer | null> {
	try {
		const original = await readStoryImage(`${storyId}/section_1.webp`);
		return await sharp(original)
			.resize(ANCHOR_WIDTH, ANCHOR_HEIGHT)
			.webp({ quality: ANCHOR_QUALITY })
			.toBuffer();
	} catch (err) {
		// An unusable anchor costs continuity, not the section: the image is still
		// generated, just unanchored, the way it was before anchoring existed.
		console.warn(`Could not prepare the anchor image for ${storyId}.`, err);
		return null;
	}
}

/**
 * Generates a section's background image, or joins the request already
 * generating that exact image. Reading prepares a section's media ahead and can
 * also be asked for it on arrival; images are billed per call and are not
 * content-addressed the way narration is, so identical concurrent requests
 * share one provider call instead of paying twice for the same picture.
 */
export async function createBackgroundImage(
	openai: OpenAI,
	genre: Genre,
	storyText: string,
	storyId: string,
	options: BackgroundImageOptions = {},
): Promise<StoryBackgroundImage> {
	// Keyed on the request rather than on the finished prompt: resolving the
	// anchor image is async, and the dedupe has to happen before the first await
	// or two concurrent callers both miss the map and pay for the same picture.
	const key = [
		genre.id,
		storyId,
		options.sectionIndex ?? "none",
		options.anchorToFirstSection ? "anchored" : "plain",
		options.visualContext ?? "",
		storyText,
	].join("\0");
	const inFlight = backgroundImagesInFlight.get(key);
	if (inFlight) return inFlight;

	const request = generateBackgroundImage(
		openai,
		genre,
		storyText,
		storyId,
		options,
	).finally(() => {
		backgroundImagesInFlight.delete(key);
	});
	backgroundImagesInFlight.set(key, request);
	return request;
}

async function generateBackgroundImage(
	openai: OpenAI,
	genre: Genre,
	storyText: string,
	storyId: string,
	options: BackgroundImageOptions,
): Promise<StoryBackgroundImage> {
	const referenceImage = options.anchorToFirstSection
		? await readAnchorImage(storyId)
		: null;
	const prompt = buildStoryBackgroundPrompt(
		genre,
		storyText,
		options.visualContext,
		Boolean(referenceImage),
	);
	try {
		const image = await generateStoryImage({
			genre,
			openai,
			referenceImage: referenceImage ?? undefined,
			storyText,
			visualContext: options.visualContext,
		});
		const filename = imageFilename(
			genre,
			image.extension,
			options.sectionIndex,
		);
		const filePath = imagePath(storyId, filename);
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, image.image);
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
		const opening = JSON.parse(text) as PreparedReadingOpening;
		// The queue is a cache, not history: an entry written before stories were
		// generated whole holds only a frame, so drop it and prepare a real one.
		return isCompleteReadingStory(opening?.readingStory) ? opening : null;
	} catch {
		return null;
	}
}

function isCompleteReadingStory(story: unknown): story is ReadingStory {
	if (!story || typeof story !== "object") return false;
	const parts = (story as ReadingStory).parts;
	const moments = (story as ReadingStory).moments;
	return (
		typeof (story as ReadingStory).languageFocus === "string" &&
		Boolean((story as ReadingStory).languageFocus.trim()) &&
		Array.isArray(moments) &&
		moments.length === READING_STORY_TOTAL_PARTS &&
		moments.every((moment) => Boolean(moment?.trim())) &&
		Array.isArray(parts) &&
		parts.length === READING_STORY_TOTAL_PARTS &&
		parts.every((part) => Boolean(part?.text?.trim()))
	);
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

function imageFilename(
	genre: Genre,
	extension: "jpg" | "png" | "webp",
	sectionIndex?: number,
) {
	if (sectionIndex !== undefined && extension === "webp") {
		return `section_${sectionIndex}.webp`;
	}
	if (sectionIndex !== undefined) return `section_${sectionIndex}.${extension}`;
	return `${genre.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
}

function imagePath(storyId: string, filename: string) {
	if (bundleIdPattern.test(storyId))
		return bundledImagesPath(storyId, filename);
	return join(storyImagesDir, storyId, filename);
}
