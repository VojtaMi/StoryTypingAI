import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type OpenAI from "openai";
import {
	type NarrationVoiceId,
	narrationVoiceOptions,
} from "../narrationVoice";
import type { StoryOpeningAudio } from "../storyAudio";
import {
	bundledAudioPath,
	bundleIdPattern,
	pathExists,
} from "./storyBundleStore";
import { DEFAULT_GEMINI_TTS_MODEL, OPENAI_TTS_MODEL, tts } from "./tts";
import type { TtsProvider } from "./tts/types";

const storyAudioDir = join(process.cwd(), "story-audio");

export const audioFilePattern = /^[a-zA-Z0-9_-]+\.(mp3|wav)$/;

export async function createOpeningAudio(
	openai: OpenAI,
	text: string,
	storyId: string,
	narrationVoice: NarrationVoiceId,
	options: { sectionIndex?: number } = {},
): Promise<StoryOpeningAudio | null> {
	try {
		const existingAudio = await findExistingSectionAudio(
			text,
			storyId,
			narrationVoice,
			options.sectionIndex,
		);
		if (existingAudio) return existingAudio;

		const speech = await tts({
			openai,
			text,
			...narrationVoiceOptions(narrationVoice),
		});
		const filename = audioFilename(
			text,
			narrationVoice,
			speech.provider,
			speech.extension,
			options.sectionIndex,
		);
		const filePath = audioPath(storyId, filename);
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, speech.audio);
		return {
			openingAudioUrl: `/api/story-audio/${storyId}/${filename}`,
			openingAudioSource: "generated",
			openingAudioText: text,
			openingAudioTextHash: audioTextHash(text),
			openingAudioVoice: narrationVoice,
			openingAudioProvider: speech.provider,
			openingAudioModel: speech.model,
			openingAudioMimeType: speech.mimeType,
		};
	} catch (err) {
		console.warn("Could not generate opening audio.", err);
		return null;
	}
}

async function findExistingSectionAudio(
	text: string,
	storyId: string,
	narrationVoice: NarrationVoiceId,
	sectionIndex?: number,
): Promise<StoryOpeningAudio | null> {
	if (sectionIndex === undefined) return null;

	const provider = activeExistingProvider();
	const filename = audioFilename(
		text,
		narrationVoice,
		provider.provider,
		provider.extension,
		sectionIndex,
	);
	if (!(await pathExists(audioPath(storyId, filename)))) return null;

	return {
		openingAudioUrl: `/api/story-audio/${storyId}/${filename}`,
		openingAudioSource: "generated",
		openingAudioText: text,
		openingAudioTextHash: audioTextHash(text),
		openingAudioVoice: narrationVoice,
		openingAudioProvider: provider.provider,
		openingAudioModel: provider.model,
		openingAudioMimeType: provider.mimeType,
	};
}

function activeExistingProvider(): {
	provider: TtsProvider;
	extension: "mp3" | "wav";
	mimeType: "audio/mpeg" | "audio/wav";
	model: string;
} {
	const openai = {
		provider: "openai" as const,
		extension: "mp3" as const,
		mimeType: "audio/mpeg" as const,
		model: OPENAI_TTS_MODEL,
	};
	const gemini = {
		provider: "gemini" as const,
		extension: "wav" as const,
		mimeType: "audio/wav" as const,
		model: DEFAULT_GEMINI_TTS_MODEL,
	};
	return process.env.GEMINI_API_KEY ? gemini : openai;
}

export async function readStoryAudio(relativePath: string) {
	const [storyId, filename] = relativePath.split("/");
	if (storyId && filename) {
		const bundled = bundledAudioPath(storyId, filename);
		if (await pathExists(bundled)) return readFile(bundled);
	}
	return readFile(join(storyAudioDir, relativePath));
}

function audioFilename(
	text: string,
	voice: NarrationVoiceId,
	provider: string,
	extension: "mp3" | "wav",
	sectionIndex?: number,
) {
	if (sectionIndex !== undefined) {
		return `section_${sectionIndex}_${voice}_${provider}_${audioTextHash(text)}.${extension}`;
	}
	return `opening-${audioTextHash(text)}-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
}

function audioPath(storyId: string, filename: string) {
	if (bundleIdPattern.test(storyId)) return bundledAudioPath(storyId, filename);
	return join(storyAudioDir, storyId, filename);
}

function audioTextHash(text: string) {
	return createHash("sha256").update(text).digest("hex").slice(0, 12);
}
