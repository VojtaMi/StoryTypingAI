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
import { tts } from "./tts";

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
