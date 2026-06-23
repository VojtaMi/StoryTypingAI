import { randomUUID } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import OpenAI from "openai";
import {
	isNarrationVoiceId,
	type NarrationVoiceId,
	pickRandomNarrationVoice,
} from "../src/narrationVoice.ts";
import { createOpeningAudio } from "../src/server/storyAudioStore.ts";

type JsonRecord = {
	id?: string;
	text?: string;
	openingAudioUrl?: string;
	openingAudioSource?: string;
	openingAudioText?: string;
	openingAudioVoice?: NarrationVoiceId;
	narrationVoice?: NarrationVoiceId;
	segments?: Array<{
		author?: string;
		text?: string;
	}>;
	currentTarget?: string | null;
	messages?: Array<{
		role?: string;
		content?: string;
	}>;
};

const openaiKey = process.env.OPENAI_API_KEY ?? "";
if (!openaiKey) {
	console.error("Error: OPENAI_API_KEY is required.");
	process.exit(1);
}

const openai = new OpenAI({ apiKey: openaiKey });

let generated = 0;
let skipped = 0;

for (const folder of ["openings", "saves"]) {
	for (const file of await jsonFiles(folder)) {
		await backfillFile(file);
	}
}

console.log(
	`Opening audio backfill complete. Generated: ${generated}. Skipped: ${skipped}.`,
);

async function jsonFiles(folder: string): Promise<string[]> {
	try {
		const names = await readdir(folder);
		return names
			.filter((name) => name.endsWith(".json"))
			.sort()
			.map((name) => join(folder, name));
	} catch {
		return [];
	}
}

async function backfillFile(path: string) {
	const raw = await readFile(path, "utf8");
	const record = JSON.parse(raw) as JsonRecord;
	const narrationVoice = isNarrationVoiceId(record.narrationVoice)
		? record.narrationVoice
		: pickRandomNarrationVoice();
	if (
		record.openingAudioUrl &&
		record.narrationVoice === narrationVoice &&
		record.openingAudioVoice === narrationVoice
	) {
		skipped += 1;
		return;
	}

	const text = openingText(record);
	if (!text) {
		console.warn(`Skipping ${path}: could not find opening text.`);
		skipped += 1;
		return;
	}

	const id = record.id ?? randomUUID();
	const audio = await createOpeningAudio(openai, text, id, narrationVoice);
	if (!audio) {
		console.warn(`Skipping ${path}: audio generation failed.`);
		skipped += 1;
		return;
	}

	const updated: JsonRecord = {
		...record,
		id,
		narrationVoice,
		...audio,
	};
	await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
	console.log(`Generated opening audio for ${basename(path)}.`);
	generated += 1;
}

function openingText(record: JsonRecord): string {
	return (
		clean(record.text) ??
		clean(record.segments?.find((segment) => segment.author === "ai")?.text) ??
		clean(record.currentTarget) ??
		clean(
			record.messages?.find((message) => message.role === "assistant")?.content,
		) ??
		""
	);
}

function clean(value: string | null | undefined): string | undefined {
	const text = value?.trim();
	return text || undefined;
}
