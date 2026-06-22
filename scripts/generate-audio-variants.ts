import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import OpenAI from "openai";
import { TTS_MODEL } from "../src/models.ts";
import {
	type SpeechOptions,
	synthesizeSpeech,
} from "../src/server/aiService.ts";

type OpeningRecord = {
	genreId?: string;
	text?: string;
	openingAudioText?: string;
	currentTarget?: string | null;
	messages?: Array<{ role?: string; content?: string }>;
};

type Variant = Required<Pick<SpeechOptions, "voice">> &
	Pick<SpeechOptions, "instructions" | "speed"> & {
		id: string;
		label: string;
	};

const variants: Variant[] = [
	{
		id: "marin-warm-teacher",
		label: "Warm teacher",
		voice: "marin",
		speed: 0.88,
		instructions:
			"Read like a warm beginner language teacher. Keep the Esperanto pronunciation careful, friendly, and unhurried, with tiny pauses between short sentences.",
	},
	{
		id: "cedar-storybook",
		label: "Storybook guide",
		voice: "cedar",
		speed: 0.92,
		instructions:
			"Read like an immersive storybook narrator for a gentle interactive lesson. Sound curious and grounded, with soft suspense at the final image.",
	},
	{
		id: "fable-playful",
		label: "Playful discovery",
		voice: "fable",
		speed: 0.95,
		instructions:
			"Read with playful curiosity, as if noticing something small moving in the bushes. Keep it clear for a beginner typing exercise.",
	},
	{
		id: "coral-gentle",
		label: "Gentle bright",
		voice: "coral",
		speed: 0.9,
		instructions:
			"Read softly and brightly, with a calm encouraging tone. Make each simple Esperanto sentence feel easy to follow.",
	},
	{
		id: "sage-slow-lesson",
		label: "Slow lesson",
		voice: "sage",
		speed: 0.78,
		instructions:
			"Read slowly and clearly for a new Esperanto learner. Prioritize intelligibility, crisp vowels, and comfortable pauses over drama.",
	},
	{
		id: "onyx-mysterious",
		label: "Mysterious park",
		voice: "onyx",
		speed: 0.86,
		instructions:
			"Read with quiet mystery and restraint, as if the park is peaceful but something surprising is about to happen. Keep the pronunciation clear.",
	},
];

const openingPath = process.argv[2] ?? "openings/esperanto.json";
const openaiKey = process.env.OPENAI_API_KEY ?? "";

if (!openaiKey) {
	console.error("Error: OPENAI_API_KEY is required.");
	process.exit(1);
}

const opening = JSON.parse(
	await readFile(openingPath, "utf8"),
) as OpeningRecord;
const text = openingText(opening);
if (!text) {
	console.error(`Error: could not find opening text in ${openingPath}.`);
	process.exit(1);
}

const genreId = opening.genreId ?? "opening";
const outputDir = join("story-audio", "voice-experiments");
await mkdir(outputDir, { recursive: true });

const openai = new OpenAI({ apiKey: openaiKey });
const manifest = {
	source: openingPath,
	model: TTS_MODEL,
	generatedAt: new Date().toISOString(),
	text,
	variants: [] as Array<Variant & { file: string }>,
};

for (const variant of variants) {
	const filename = `${genreId}-${variant.id}.mp3`;
	const file = join(outputDir, filename);
	const audio = await synthesizeSpeech(openai, text, variant);
	await writeFile(file, audio);
	manifest.variants.push({ ...variant, file });
	console.log(`Generated ${variant.label}: ${file}`);
}

const manifestPath = join(outputDir, `${genreId}-manifest.json`);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote manifest: ${manifestPath}`);

function openingText(record: OpeningRecord): string {
	return (
		clean(record.openingAudioText) ??
		clean(record.text) ??
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
