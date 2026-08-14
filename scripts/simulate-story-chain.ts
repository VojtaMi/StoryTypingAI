/** Simulate a text-only typing-story session through the production prompt chain. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import OpenAI from "openai";
import { type GenreId, genres } from "../src/genres.ts";
import {
	DEFAULT_TEXT_MODEL,
	TEXT_MODELS,
	type TextModelId,
} from "../src/models.ts";
import { completeAi } from "../src/server/aiService.ts";
import {
	AI_CONTINUE_PROMPT,
	type ChatMessage,
	continuationMessages,
	openingMessages,
} from "../src/story.ts";
import {
	prepareStoryContext,
	type StoryMemory,
} from "../src/story_memory/index.ts";

export interface StoryChainCliOptions {
	authorInputsPath?: string;
	genre: GenreId;
	help: boolean;
	json: boolean;
	length: number;
	model: TextModelId;
	retries: number;
	seed?: string;
}

export interface StoryChainStep {
	index: number;
	authorText: string;
	autoContinued: boolean;
	segment: string;
	memory?: StoryMemory;
}

export interface StoryChainReport {
	genre: GenreId;
	model: TextModelId;
	seed: string;
	opening: string;
	steps: StoryChainStep[];
}

const HELP = `Usage: npm run story:chain -- [options]

Generate a text-only chain of typing-story segments through the production
opening, continuation, and memory-compaction pipeline. It does not synthesize
narration or generate images.

Options:
  -n, --length <n>         Number of continuations to generate (default: 5)
  --genre <id>             ${genres.map(({ id }) => id).join("|")} (default: scifi)
  --seed <text>            Opening seed (default: random seed for the genre)
  --author-inputs <path>   JSON array of simulated author continuations
  --model <id>             Text model (default: ${DEFAULT_TEXT_MODEL})
  --retries <n>            Retry a failed generation up to n times (default: 2)
  --json                   Emit one JSON document instead of a readable report
  --help                   Show this help

When author inputs run out, the chain uses the app's automatic-continuation
prompt. Provider calls cost money and require the matching API key.
`;

export function parseStoryChainCliArgs(
	rawArgs: string[],
): StoryChainCliOptions {
	const options: StoryChainCliOptions = {
		genre: "scifi",
		help: false,
		json: false,
		length: 5,
		model: DEFAULT_TEXT_MODEL,
		retries: 2,
	};

	for (let index = 0; index < rawArgs.length; index += 1) {
		const argument = rawArgs[index];
		switch (argument) {
			case "--help":
				options.help = true;
				break;
			case "--json":
				options.json = true;
				break;
			case "-n":
			case "--length":
				options.length = parseIntegerFlag(
					requiredFlagValue(rawArgs, index, argument),
					argument,
					true,
				);
				index += 1;
				break;
			case "--retries":
				options.retries = parseIntegerFlag(
					requiredFlagValue(rawArgs, index, argument),
					argument,
					false,
				);
				index += 1;
				break;
			case "--genre": {
				const value = requiredFlagValue(rawArgs, index, argument);
				const genre = genres.find((candidate) => candidate.id === value);
				if (!genre) {
					throw new Error(
						`Unknown genre "${value}". Valid genres: ${genres.map(({ id }) => id).join(", ")}`,
					);
				}
				options.genre = genre.id;
				index += 1;
				break;
			}
			case "--model": {
				const value = requiredFlagValue(rawArgs, index, argument);
				const model = TEXT_MODELS.find((candidate) => candidate.id === value);
				if (!model) {
					throw new Error(
						`Unknown model "${value}". Valid models: ${TEXT_MODELS.map(({ id }) => id).join(", ")}`,
					);
				}
				options.model = model.id;
				index += 1;
				break;
			}
			case "--seed":
				options.seed = requiredFlagValue(rawArgs, index, argument);
				index += 1;
				break;
			case "--author-inputs":
				options.authorInputsPath = requiredFlagValue(rawArgs, index, argument);
				index += 1;
				break;
			default:
				throw new Error(
					`Unknown argument "${argument}". Use --help for usage.`,
				);
		}
	}

	return options;
}

function requiredFlagValue(
	rawArgs: string[],
	index: number,
	flag: string,
): string {
	const value = rawArgs[index + 1]?.trim();
	if (!value || value.startsWith("--")) {
		throw new Error(`${flag} requires a value.`);
	}
	return value;
}

function parseIntegerFlag(value: string, flag: string, positive: boolean) {
	const parsed = Number(value);
	const valid =
		Number.isInteger(parsed) && (positive ? parsed > 0 : parsed >= 0);
	if (!valid) {
		throw new Error(
			`${flag} must be a ${positive ? "positive" : "non-negative"} integer.`,
		);
	}
	return parsed;
}

export async function loadAuthorInputs(path?: string): Promise<string[]> {
	if (!path) return [];
	let value: unknown;
	try {
		value = JSON.parse(await readFile(path, "utf8"));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Could not read author inputs "${path}": ${message}`);
	}
	if (
		!Array.isArray(value) ||
		value.some((item) => typeof item !== "string" || !item.trim())
	) {
		throw new Error("Author inputs must be a JSON array of non-empty strings.");
	}
	return value.map((item) => item.trim());
}

async function generateWithRetries(
	generate: () => Promise<string>,
	retries: number,
	label: string,
): Promise<string> {
	for (let attempt = 0; ; attempt += 1) {
		try {
			return await generate();
		} catch (error) {
			if (attempt >= retries) throw error;
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(
				`${label} failed (${message}); retrying ${attempt + 1}/${retries}...\n`,
			);
		}
	}
}

export async function runStoryChainCli(rawArgs: string[]): Promise<void> {
	const options = parseStoryChainCliArgs(rawArgs);
	if (options.help) {
		process.stdout.write(HELP);
		return;
	}

	const openaiKey = process.env.OPENAI_API_KEY ?? "";
	const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
	const geminiKey = process.env.GEMINI_API_KEY ?? "";
	if (options.model.startsWith("claude-") && !anthropicKey) {
		throw new Error("ANTHROPIC_API_KEY is required for Claude models.");
	}
	if (options.model.startsWith("gemini-") && !geminiKey) {
		throw new Error("GEMINI_API_KEY is required for Gemini models.");
	}
	if (
		!options.model.startsWith("claude-") &&
		!options.model.startsWith("gemini-") &&
		!openaiKey
	) {
		throw new Error("OPENAI_API_KEY is required for OpenAI models.");
	}

	const openai =
		options.model.startsWith("claude-") || options.model.startsWith("gemini-")
			? ({} as OpenAI)
			: new OpenAI({ apiKey: openaiKey });
	const complete = (messages: ChatMessage[], maxTokens: number) =>
		completeAi(
			openai,
			messages,
			maxTokens,
			options.model,
			anthropicKey,
			geminiKey,
		);
	const genre = genres.find(({ id }) => id === options.genre);
	if (!genre) throw new Error(`Genre "${options.genre}" is not configured.`);
	const seed =
		options.seed ??
		genre.seeds[Math.floor(Math.random() * genre.seeds.length)] ??
		"unexpected discovery";
	const authorInputs = await loadAuthorInputs(options.authorInputsPath);

	process.stderr.write(
		`Generating ${genre.label} opening with ${options.model}...\n`,
	);
	const opening = await generateWithRetries(
		() => complete(openingMessages(genre, seed), 200),
		options.retries,
		"Opening",
	);
	let messages: ChatMessage[] = [
		...openingMessages(genre, seed),
		{ role: "assistant", content: opening },
	];
	let memory: StoryMemory | undefined;
	const steps: StoryChainStep[] = [];

	for (let index = 0; index < options.length; index += 1) {
		const suppliedAuthorText = authorInputs[index];
		const authorText = suppliedAuthorText ?? AI_CONTINUE_PROMPT;
		const nextMessages = continuationMessages(messages, authorText);
		const context = await prepareStoryContext(nextMessages, memory, complete);
		process.stderr.write(
			`Generating continuation ${index + 1}/${options.length}...\n`,
		);
		const segment = await generateWithRetries(
			() => complete(context.messages, 400),
			options.retries,
			`Continuation ${index + 1}`,
		);
		messages = [...nextMessages, { role: "assistant", content: segment }];
		memory = context.memory;
		steps.push({
			index: index + 1,
			authorText,
			autoContinued: suppliedAuthorText === undefined,
			segment,
			...(memory ? { memory } : {}),
		});
	}

	const report: StoryChainReport = {
		genre: genre.id,
		model: options.model,
		seed,
		opening,
		steps,
	};
	if (options.json) {
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
		return;
	}

	process.stdout.write(
		`\n${genre.emoji} ${genre.label} · ${options.model} · seed: ${seed}\n\nOpening\n${opening}\n`,
	);
	for (const step of steps) {
		process.stdout.write(
			`\nAuthor ${step.index}${step.autoContinued ? " (automatic)" : ""}\n${step.authorText}\n\nSegment ${step.index}\n${step.segment}\n`,
		);
	}
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
	runStoryChainCli(process.argv.slice(2)).catch((error) => {
		const message = error instanceof Error ? error.message : String(error);
		process.stderr.write(`Error: ${message}\n`);
		process.exitCode = 1;
	});
}
