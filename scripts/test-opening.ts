/**
 * CLI tool to generate and preview story openings without the UI or image generation.
 *
 * Usage:
 *   npm run test:opening                           # generate one opening per genre
 *   npm run test:opening -- scifi                  # generate only the scifi opening
 *   npm run test:opening -- scifi 3                # generate 3 scifi openings in a row
 *   npm run test:opening -- --model gpt-5.5 scifi  # use a specific model
 */
import OpenAI from "openai";
import { type GenreId, genres } from "../src/genres.ts";
import {
	DEFAULT_TEXT_MODEL,
	TEXT_MODELS,
	type TextModelId,
} from "../src/models.ts";
import { completeAi } from "../src/server/aiService.ts";

const args = process.argv.slice(2);

const modelFlagIndex = args.indexOf("--model");
let model: TextModelId = DEFAULT_TEXT_MODEL;
if (modelFlagIndex !== -1) {
	const modelArg = args[modelFlagIndex + 1];
	const valid = TEXT_MODELS.find((m) => m.id === modelArg);
	if (!valid) {
		const ids = TEXT_MODELS.map((m) => m.id).join(", ");
		console.error(`Unknown model "${modelArg}". Valid models: ${ids}`);
		process.exit(1);
	}
	model = valid.id;
	args.splice(modelFlagIndex, 2);
}

const [genreArg, countArg] = args;
const count = countArg ? Number.parseInt(countArg, 10) : 1;

const targetGenres = genreArg
	? genres.filter((g) => g.id === (genreArg as GenreId))
	: genres;

if (genreArg && targetGenres.length === 0) {
	const ids = genres.map((g) => g.id).join(", ");
	console.error(`Unknown genre "${genreArg}". Valid genres: ${ids}`);
	process.exit(1);
}

const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
const openaiKey = process.env.OPENAI_API_KEY ?? "";

if (model.startsWith("claude-") && !anthropicKey) {
	console.error("Error: ANTHROPIC_API_KEY is required for Claude models.");
	process.exit(1);
}
if (!model.startsWith("claude-") && !openaiKey) {
	console.error("Error: OPENAI_API_KEY is required for OpenAI models.");
	process.exit(1);
}

const openai = new OpenAI({ apiKey: openaiKey });

console.log(`Using model: ${model}`);

for (const genre of targetGenres) {
	for (let i = 0; i < count; i++) {
		const seed = genre.seeds[Math.floor(Math.random() * genre.seeds.length)];
		const separator = "─".repeat(60);
		console.log(`\n${separator}`);
		console.log(`${genre.emoji}  ${genre.label}  |  seed: ${seed}`);
		console.log(separator);

		const messages = [
			{ role: "system" as const, content: genre.systemPrompt },
			{
				role: "user" as const,
				content: `Begin the story. Seed element: ${seed}.`,
			},
		];

		const openingText = await completeAi(
			openai,
			messages,
			200,
			model,
			anthropicKey,
		);
		console.log(`\nOpening:\n${openingText}`);

		const introText = await completeAi(
			openai,
			[
				{
					role: "system" as const,
					content:
						"Write a 1-2 sentence second-person character introduction for an interactive story. " +
						"State concretely who the player character is and what brought them to this place. " +
						"Start with 'You'. Output only the introduction — no quotes, no headings.",
				},
				{
					role: "user" as const,
					content: `${genre.label} story opening:\n${openingText}`,
				},
			],
			100,
			model,
			anthropicKey,
		);
		console.log(`\nBackground intro:\n${introText}`);
	}
}
