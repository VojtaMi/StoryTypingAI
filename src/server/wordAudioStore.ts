import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type OpenAI from "openai";
import { synthesizeSpeech } from "./aiService";

const wordAudioDir = join(process.cwd(), "word-audio");

export const wordFilePattern = /^[a-zA-ZĉĝĥĵŝŭĈĜĤĴŜŬ]+\.mp3$/u;

export async function getOrCreateWordAudio(
	openai: OpenAI,
	word: string,
): Promise<string> {
	const filename = `${word}.mp3`;
	const filepath = join(wordAudioDir, filename);

	try {
		await readFile(filepath);
		console.log(`[word-audio] HIT  ${word}`);
		return `/api/word-audio/${encodeURIComponent(word)}`;
	} catch {
		console.log(`[word-audio] MISS ${word} — calling TTS`);
	}

	const audio = await synthesizeSpeech(openai, word, {
		instructions:
			"Pronounce this single Esperanto word clearly, slowly, and in isolation — as if teaching a language learner.",
	});
	await mkdir(wordAudioDir, { recursive: true });
	await writeFile(filepath, audio);
	return `/api/word-audio/${encodeURIComponent(word)}`;
}

export async function readWordAudio(word: string): Promise<Buffer> {
	return readFile(join(wordAudioDir, `${word}.mp3`));
}
