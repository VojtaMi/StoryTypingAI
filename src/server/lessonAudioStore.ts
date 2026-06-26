import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type OpenAI from "openai";
import { synthesizeSpeech } from "./aiService";

const lessonAudioDir = join(process.cwd(), "lesson-audio");

export const lessonIdPattern = /^[a-zA-Z0-9_-]+$/;
export const lessonAudioFilePattern = /^[a-zA-Z0-9_Ā-ſ-]+\.mp3$/;

/** Converts lesson text to a stable filename slug. */
function textToSlug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9Ā-ſ]+/gu, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 60);
}

/**
 * Returns the URL for a lesson audio file, generating and saving it on first
 * call. Subsequent calls for the same lessonId + text return immediately
 * without hitting the TTS API.
 */
export async function getOrCreateLessonAudio(
	openai: OpenAI,
	lessonId: string,
	text: string,
	instructions?: string,
): Promise<string> {
	const slug = textToSlug(text);
	const filename = `${slug}.mp3`;
	const folder = join(lessonAudioDir, lessonId);
	const filepath = join(folder, filename);

	try {
		await readFile(filepath);
		console.log(`[lesson-audio] HIT  ${filepath}`);
		return `/api/lesson-audio/${lessonId}/${filename}`;
	} catch {
		console.log(`[lesson-audio] MISS ${filepath} — calling TTS`);
	}

	const audio = await synthesizeSpeech(openai, text, { instructions });
	await mkdir(folder, { recursive: true });
	await writeFile(filepath, audio);
	return `/api/lesson-audio/${lessonId}/${filename}`;
}

export async function readLessonAudio(
	lessonId: string,
	filename: string,
): Promise<Buffer> {
	return readFile(join(lessonAudioDir, lessonId, filename));
}
