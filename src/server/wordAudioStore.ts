import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type OpenAI from "openai";
import { tts } from "./tts";
import type { SynthesizedSpeech } from "./tts/types";

const wordAudioDir = join(process.cwd(), "word-audio");

export const wordFilePattern = /^[a-zA-ZĉĝĥĵŝŭĈĜĤĴŜŬ]+\.(mp3|wav)$/u;

function wordAudioUrl(word: string, version: number): string {
	return `/api/word-audio/${encodeURIComponent(word)}?v=${version}`;
}

function preferredWordAudioFilename(word: string): string {
	return `${word}.${process.env.GEMINI_API_KEY ? "wav" : "mp3"}`;
}

async function findCachedWordAudio(filenames: string[]) {
	for (const filename of filenames) {
		try {
			const file = await stat(join(wordAudioDir, filename));
			return { filename, mtimeMs: file.mtimeMs };
		} catch {
			// Try the next cache format.
		}
	}
	return null;
}

function allWordAudioFilenames(word: string): string[] {
	const preferredFilename = preferredWordAudioFilename(word);
	return [
		preferredFilename,
		...[`${word}.wav`, `${word}.mp3`].filter(
			(filename) => filename !== preferredFilename,
		),
	];
}

function wordAudioMimeType(filename: string): SynthesizedSpeech["mimeType"] {
	return filename.endsWith(".wav") ? "audio/wav" : "audio/mpeg";
}

async function synthesizeWordAudio(
	openai: OpenAI,
	word: string,
): Promise<string> {
	const speech = await tts({
		openai,
		text: word,
		provider: "gemini",
		instructions:
			"Pronounce this single Esperanto word clearly, slowly, and in isolation — as if teaching a language learner.",
	});
	await mkdir(wordAudioDir, { recursive: true });
	await writeFile(
		join(wordAudioDir, `${word}.${speech.extension}`),
		speech.audio,
	);
	return wordAudioUrl(word, Date.now());
}

export async function getOrCreateWordAudio(
	openai: OpenAI,
	word: string,
): Promise<string> {
	const cached = await findCachedWordAudio([preferredWordAudioFilename(word)]);
	if (cached) {
		console.log(`[word-audio] HIT  ${word}`);
		return wordAudioUrl(word, Math.floor(cached.mtimeMs));
	}

	console.log(`[word-audio] MISS ${word} — calling TTS`);
	return synthesizeWordAudio(openai, word);
}

export async function regenerateWordAudio(
	openai: OpenAI,
	word: string,
): Promise<string> {
	for (const extension of ["wav", "mp3"]) {
		try {
			await unlink(join(wordAudioDir, `${word}.${extension}`));
		} catch {
			// Missing cached audio is fine; regeneration should still create it.
		}
	}
	console.log(`[word-audio] REGEN ${word} — calling TTS`);
	return synthesizeWordAudio(openai, word);
}

export async function readWordAudio(
	word: string,
): Promise<{ audio: Buffer; mimeType: SynthesizedSpeech["mimeType"] }> {
	const cached = await findCachedWordAudio(allWordAudioFilenames(word));
	if (!cached) {
		throw new Error("Audio not found.");
	}
	return {
		audio: await readFile(join(wordAudioDir, cached.filename)),
		mimeType: wordAudioMimeType(cached.filename),
	};
}
