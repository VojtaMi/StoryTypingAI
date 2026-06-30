import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type OpenAI from "openai";
import {
	type NarrationVoiceId,
	narrationVoiceOptions,
} from "../narrationVoice";
import type { StoryOpeningAudio } from "../storyAudio";
import { synthesizeSpeech } from "./aiService";
import {
	bundledAudioPath,
	bundleIdPattern,
	pathExists,
} from "./storyBundleStore";

const storyAudioDir = join(process.cwd(), "story-audio");

export const audioFilePattern = /^[a-zA-Z0-9_-]+\.mp3$/;

export async function createOpeningAudio(
	openai: OpenAI,
	text: string,
	storyId: string,
	narrationVoice: NarrationVoiceId,
	options: { sectionIndex?: number } = {},
): Promise<StoryOpeningAudio | null> {
	try {
		const audio = await synthesizeSpeech(
			openai,
			text,
			narrationVoiceOptions(narrationVoice),
		);
		const filename = audioFilename(narrationVoice, options.sectionIndex);
		const filePath = audioPath(storyId, filename);
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, audio);
		return {
			openingAudioUrl: `/api/story-audio/${storyId}/${filename}`,
			openingAudioSource: "generated",
			openingAudioText: text,
			openingAudioVoice: narrationVoice,
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

function audioFilename(voice: NarrationVoiceId, sectionIndex?: number) {
	if (sectionIndex !== undefined) return `section_${sectionIndex}_${voice}.mp3`;
	return `opening-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
}

function audioPath(storyId: string, filename: string) {
	if (bundleIdPattern.test(storyId)) return bundledAudioPath(storyId, filename);
	return join(storyAudioDir, storyId, filename);
}
