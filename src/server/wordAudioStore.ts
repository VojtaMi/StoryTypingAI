import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type OpenAI from "openai";
import { synthesizeSpeech } from "./tts";

const wordAudioDir = join(process.cwd(), "word-audio");

export const wordFilePattern = /^[a-zA-ZĉĝĥĵŝŭĈĜĤĴŜŬ]+\.mp3$/u;

function wordAudioUrl(word: string, version: number): string {
	return `/api/word-audio/${encodeURIComponent(word)}?v=${version}`;
}

async function synthesizeWordAudio(
	openai: OpenAI,
	word: string,
): Promise<string> {
	const audio = await synthesizeSpeech(openai, word, {
		instructions:
			"Pronounce this single Esperanto word clearly, slowly, and in isolation — as if teaching a language learner.",
	});
	await mkdir(wordAudioDir, { recursive: true });
	await writeFile(join(wordAudioDir, `${word}.mp3`), audio);
	return wordAudioUrl(word, Date.now());
}

export async function getOrCreateWordAudio(
	openai: OpenAI,
	word: string,
): Promise<string> {
	const filename = `${word}.mp3`;
	const filepath = join(wordAudioDir, filename);

	try {
		const file = await stat(filepath);
		console.log(`[word-audio] HIT  ${word}`);
		return wordAudioUrl(word, Math.floor(file.mtimeMs));
	} catch {
		console.log(`[word-audio] MISS ${word} — calling TTS`);
	}

	return synthesizeWordAudio(openai, word);
}

export async function regenerateWordAudio(
	openai: OpenAI,
	word: string,
): Promise<string> {
	try {
		await unlink(join(wordAudioDir, `${word}.mp3`));
	} catch {
		// Missing cached audio is fine; regeneration should still create it.
	}
	console.log(`[word-audio] REGEN ${word} — calling TTS`);
	return synthesizeWordAudio(openai, word);
}

export async function readWordAudio(word: string): Promise<Buffer> {
	return readFile(join(wordAudioDir, `${word}.mp3`));
}
