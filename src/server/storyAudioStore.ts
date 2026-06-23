import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type OpenAI from "openai";
import {
	type NarrationVoiceId,
	narrationVoiceOptions,
} from "../narrationVoice";
import type { StoryOpeningAudio } from "../storyAudio";
import { synthesizeSpeech } from "./aiService";

const storyAudioDir = join(process.cwd(), "story-audio");

export const audioFilePattern = /^[a-zA-Z0-9_-]+\.mp3$/;

export async function createOpeningAudio(
	openai: OpenAI,
	text: string,
	storyId: string,
	narrationVoice: NarrationVoiceId,
): Promise<StoryOpeningAudio | null> {
	try {
		const audio = await synthesizeSpeech(
			openai,
			text,
			narrationVoiceOptions(narrationVoice),
		);
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
			openingAudioVoice: narrationVoice,
		};
	} catch (err) {
		console.warn("Could not generate opening audio.", err);
		return null;
	}
}

export async function readStoryAudio(relativePath: string) {
	return readFile(join(storyAudioDir, relativePath));
}
