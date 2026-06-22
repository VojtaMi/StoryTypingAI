import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type OpenAI from "openai";
import type { StoryOpeningAudio } from "../storyAudio";
import { type SpeechOptions, synthesizeSpeech } from "./aiService";

const storyAudioDir = join(process.cwd(), "story-audio");

export const audioFilePattern = /^[a-zA-Z0-9_-]+\.mp3$/;

export async function createOpeningAudio(
	openai: OpenAI,
	text: string,
	storyId: string,
	options: SpeechOptions = {},
): Promise<StoryOpeningAudio | null> {
	try {
		const audio = await synthesizeSpeech(openai, text, options);
		const folder = join(storyAudioDir, storyId);
		await mkdir(folder, { recursive: true });
		const filename = `opening-${Date.now()}-${Math.random()
			.toString(36)
			.slice(2)}.mp3`;
		await writeFile(join(folder, filename), audio);
		return {
			openingAudioUrl: `/api/story-audio/${storyId}/${filename}`,
			openingAudioSource: "generated",
			openingAudioText: text,
		};
	} catch (err) {
		console.warn("Could not generate opening audio.", err);
		return null;
	}
}

export async function readStoryAudio(relativePath: string) {
	return readFile(join(storyAudioDir, relativePath));
}
