/** Generate and preview typing-story openings without the UI or images. */
import OpenAI from "openai";
import { type GenreId, genres } from "../src/genres.ts";
import {
	DEFAULT_TEXT_MODEL,
	TEXT_MODELS,
	type TextModelId,
} from "../src/models.ts";
import { completeAi } from "../src/server/aiService.ts";
import {
	type Complete,
	generateIntro,
	generateTitle,
	openingMessages,
} from "../src/story.ts";

const args = process.argv.slice(2);

const seedFlagIndex = args.indexOf("--seed");
let forcedSeed: string | undefined;
if (seedFlagIndex !== -1) {
	forcedSeed = args[seedFlagIndex + 1]?.trim();
	if (!forcedSeed) {
		console.error("Error: --seed requires a value.");
		process.exit(1);
	}
	args.splice(seedFlagIndex, 2);
}

const modelFlagIndex = args.indexOf("--model");
let model: TextModelId = DEFAULT_TEXT_MODEL;
if (modelFlagIndex !== -1) {
	const modelArg = args[modelFlagIndex + 1];
	const valid = TEXT_MODELS.find((candidate) => candidate.id === modelArg);
	if (!valid) {
		const ids = TEXT_MODELS.map(({ id }) => id).join(", ");
		console.error(`Unknown model "${modelArg}". Valid models: ${ids}`);
		process.exit(1);
	}
	model = valid.id;
	args.splice(modelFlagIndex, 2);
}

const [genreArg, countArg, ...extraArgs] = args;
if (extraArgs.length > 0) {
	console.error(`Unknown argument "${extraArgs[0]}".`);
	process.exit(1);
}
const count = countArg ? Number.parseInt(countArg, 10) : 1;
if (!Number.isFinite(count) || count < 1) {
	console.error("Error: count must be a positive integer.");
	process.exit(1);
}

const targetGenres = genreArg
	? genres.filter((genre) => genre.id === (genreArg as GenreId))
	: genres;
if (genreArg && targetGenres.length === 0) {
	const ids = genres.map(({ id }) => id).join(", ");
	console.error(`Unknown genre "${genreArg}". Valid genres: ${ids}`);
	process.exit(1);
}

const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
const geminiKey = process.env.GEMINI_API_KEY ?? "";
const openaiKey = process.env.OPENAI_API_KEY ?? "";
if (model.startsWith("claude-") && !anthropicKey) {
	console.error("Error: ANTHROPIC_API_KEY is required for Claude models.");
	process.exit(1);
}
if (model.startsWith("gemini-") && !geminiKey) {
	console.error("Error: GEMINI_API_KEY is required for Gemini models.");
	process.exit(1);
}
if (model.startsWith("gpt-") && !openaiKey) {
	console.error("Error: OPENAI_API_KEY is required for OpenAI models.");
	process.exit(1);
}

const openai = new OpenAI({ apiKey: openaiKey || "unused-by-provider" });
const complete: Complete = (messages, maxTokens) =>
	completeAi(openai, messages, maxTokens, model, anthropicKey);

console.log(`Using model: ${model}`);

for (const genre of targetGenres) {
	for (let index = 0; index < count; index += 1) {
		const seed =
			forcedSeed ??
			(genre.seeds.length > 0
				? genre.seeds[Math.floor(Math.random() * genre.seeds.length)]
				: undefined);
		const separator = "─".repeat(60);
		console.log(`\n${separator}`);
		console.log(
			`${genre.emoji}  ${genre.label}${seed ? `  |  seed: ${seed}` : ""}`,
		);
		console.log(separator);

		const openingText = await complete(openingMessages(genre, seed), 200);
		console.log(`\nOpening:\n${openingText}`);

		const titleText = await generateTitle(complete, openingText);
		console.log(`\nTitle:\n${titleText}`);

		const introText = await generateIntro(complete, genre.label, openingText);
		console.log(`\nBackground intro:\n${introText}`);
	}
}
