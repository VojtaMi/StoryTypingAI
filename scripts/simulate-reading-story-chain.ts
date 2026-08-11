/** Simulate the production reading-story handoff chain without generating media. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import OpenAI from "openai";
import { genres } from "../src/genres.ts";
import type { LearnerContext } from "../src/learnerState.ts";
import {
	DEFAULT_TEXT_MODEL,
	TEXT_MODELS,
	TEXT_REASONING_EFFORTS,
	type TextModelId,
	type TextReasoningEffort,
} from "../src/models.ts";
import {
	type NextStoryBrief,
	STARTER_NEXT_STORY_BRIEF,
} from "../src/nextStoryBrief.ts";
import { completeStructuredAi } from "../src/server/aiService.ts";
import {
	generateNextStoryBrief,
	type NextStoryEvidence,
} from "../src/server/nextStoryBriefService.ts";
import { generateReadingStory, type ReadingStory } from "../src/story.ts";
import {
	STORY_DIFFICULTIES,
	type StoryDifficulty,
} from "../src/storyFeedback.ts";
import {
	createReadingStoryComplete,
	loadCliLearnerContext,
	requireProviderKeys,
} from "./generate-reading-story.ts";

export interface ChainFeedback {
	difficulty?: StoryDifficulty;
	practiceRequest?: string;
	nextStoryTheme?: string;
	wordLookups?: string[];
	learnerQuestions?: string[];
	recapResults?: Array<{ type: string; label: string; attempts: number }>;
}

export interface StoryChainCliOptions {
	defaultLearner: boolean;
	feedbackPath?: string;
	help: boolean;
	json: boolean;
	learnerStatePath?: string;
	length: number;
	model: TextModelId;
	reasoningEffort?: TextReasoningEffort;
	retries: number;
}

export interface StoryChainStep {
	index: number;
	inputBrief: NextStoryBrief;
	explicitTheme: string;
	story: ReadingStory;
	feedback: ChainFeedback;
	nextStoryBrief: NextStoryBrief;
}

const HELP = `Usage: npm run story:chain -- --length <n> [options]

Generate a chain of reading stories through the production prose and next-story
brief pipeline. It does not synthesize narration or call an image-generation API.

Options:
  -n, --length <n>        Number of stories to generate (default: 5)
  --feedback <path>       JSON feedback object, or an array with one per story
  --model <id>            Prose model (default: ${DEFAULT_TEXT_MODEL})
  --reasoning <effort>    OpenAI prose only: ${TEXT_REASONING_EFFORTS.join("|")}
  --retries <n>           Retry a rejected story up to n times (default: 2)
  --learner-state <path>  Use and validate a custom learner-state JSON file
  --default-learner       Use the built-in default learner state
  --json                  Emit one JSON document instead of a readable report
  --help                  Show this help

With no --feedback file, each story receives neutral {"difficulty":"right"}
feedback. A one-object file is reused for every story. An array must contain at
least n entries. Supported evidence fields are difficulty, practiceRequest,
nextStoryTheme, wordLookups, learnerQuestions, and recapResults.
`;

export function parseStoryChainCliArgs(
	rawArgs: string[],
): StoryChainCliOptions {
	const options: StoryChainCliOptions = {
		defaultLearner: false,
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
			case "--default-learner":
				options.defaultLearner = true;
				break;
			case "-n":
			case "--length": {
				const value = requiredFlagValue(rawArgs, index, argument);
				options.length = Number(value);
				if (!Number.isSafeInteger(options.length) || options.length < 1) {
					throw new Error(`${argument} must be a positive integer.`);
				}
				index += 1;
				break;
			}
			case "--feedback":
				options.feedbackPath = requiredFlagValue(rawArgs, index, argument);
				index += 1;
				break;
			case "--retries": {
				const value = requiredFlagValue(rawArgs, index, argument);
				options.retries = Number(value);
				if (!Number.isSafeInteger(options.retries) || options.retries < 0) {
					throw new Error(`${argument} must be a non-negative integer.`);
				}
				index += 1;
				break;
			}
			case "--learner-state":
				options.learnerStatePath = requiredFlagValue(rawArgs, index, argument);
				index += 1;
				break;
			case "--model": {
				const value = requiredFlagValue(rawArgs, index, argument);
				const model = TEXT_MODELS.find((candidate) => candidate.id === value);
				if (!model) throw new Error(`Unknown model "${value}".`);
				options.model = model.id;
				index += 1;
				break;
			}
			case "--reasoning": {
				const value = requiredFlagValue(rawArgs, index, argument);
				if (!TEXT_REASONING_EFFORTS.includes(value as TextReasoningEffort)) {
					throw new Error(`Unknown reasoning effort "${value}".`);
				}
				options.reasoningEffort = value as TextReasoningEffort;
				index += 1;
				break;
			}
			default:
				throw new Error(
					`Unknown argument "${argument}". Use --help for usage.`,
				);
		}
	}
	if (options.defaultLearner && options.learnerStatePath) {
		throw new Error(
			"--default-learner and --learner-state cannot be used together.",
		);
	}
	if (options.reasoningEffort && !options.model.startsWith("gpt-")) {
		throw new Error("--reasoning is supported only for OpenAI GPT models.");
	}
	return options;
}

function requiredFlagValue(
	args: string[],
	index: number,
	flag: string,
): string {
	const value = args[index + 1]?.trim();
	if (!value || value.startsWith("--"))
		throw new Error(`${flag} requires a value.`);
	return value;
}

export async function loadChainFeedback(
	path: string | undefined,
	length: number,
): Promise<ChainFeedback[]> {
	if (!path) return Array.from({ length }, () => ({ difficulty: "right" }));
	let value: unknown;
	try {
		value = JSON.parse(await readFile(path, "utf8"));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Could not read feedback "${path}": ${message}`);
	}
	const values = Array.isArray(value)
		? value
		: Array.from({ length }, () => value);
	if (values.length < length) {
		throw new Error(
			`Feedback array has ${values.length} entries; ${length} are required.`,
		);
	}
	return values
		.slice(0, length)
		.map((item, index) => parseFeedback(item, index));
}

function parseFeedback(value: unknown, index: number): ChainFeedback {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`Feedback entry ${index + 1} must be an object.`);
	}
	const item = value as Record<string, unknown>;
	const allowed = new Set([
		"difficulty",
		"practiceRequest",
		"nextStoryTheme",
		"wordLookups",
		"learnerQuestions",
		"recapResults",
	]);
	const unknown = Object.keys(item).find((key) => !allowed.has(key));
	if (unknown)
		throw new Error(
			`Feedback entry ${index + 1} has unknown field "${unknown}".`,
		);
	if (
		item.difficulty !== undefined &&
		!STORY_DIFFICULTIES.includes(item.difficulty as StoryDifficulty)
	) {
		throw new Error(`Feedback entry ${index + 1} has an invalid difficulty.`);
	}
	for (const field of ["practiceRequest", "nextStoryTheme"] as const) {
		if (item[field] !== undefined && typeof item[field] !== "string") {
			throw new Error(
				`Feedback entry ${index + 1} field ${field} must be a string.`,
			);
		}
	}
	for (const field of ["wordLookups", "learnerQuestions"] as const) {
		if (
			item[field] !== undefined &&
			(!Array.isArray(item[field]) ||
				item[field].some((entry) => typeof entry !== "string"))
		) {
			throw new Error(
				`Feedback entry ${index + 1} field ${field} must be a string array.`,
			);
		}
	}
	if (
		item.recapResults !== undefined &&
		(!Array.isArray(item.recapResults) ||
			item.recapResults.some((result) => !validRecapResult(result)))
	) {
		throw new Error(`Feedback entry ${index + 1} has invalid recapResults.`);
	}
	return item as ChainFeedback;
}

function validRecapResult(value: unknown): boolean {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const result = value as Record<string, unknown>;
	return (
		typeof result.type === "string" &&
		typeof result.label === "string" &&
		typeof result.attempts === "number" &&
		Number.isFinite(result.attempts) &&
		result.attempts >= 1
	);
}

export function evidenceFor(
	story: ReadingStory,
	feedback: ChainFeedback,
): NextStoryEvidence {
	return {
		storySummary: story.storySummary,
		storyParts: story.parts.map((part) => part.text),
		languageFocus: story.languageFocus,
		wordLookups: feedback.wordLookups ?? [],
		learnerQuestions: feedback.learnerQuestions ?? [],
		recapResults: feedback.recapResults ?? [],
		...(feedback.difficulty ? { difficulty: feedback.difficulty } : {}),
		...(feedback.practiceRequest?.trim()
			? { practiceRequest: feedback.practiceRequest.trim() }
			: {}),
	};
}

async function simulateChain(
	options: StoryChainCliOptions,
	learner: LearnerContext,
	feedbackItems: ChainFeedback[],
	onStep?: (step: StoryChainStep) => void,
): Promise<StoryChainStep[]> {
	const { anthropicKey, openaiKey } = requireProviderKeys(options.model);
	const openai = new OpenAI({ apiKey: openaiKey });
	const complete = createReadingStoryComplete(
		({ messages, maxTokens, model, reasoningEffort }) =>
			completeStructuredAi(
				openai,
				messages,
				maxTokens,
				model ?? options.model,
				anthropicKey,
				{ reasoningEffort },
			),
		options.reasoningEffort,
	);
	const genre = genres[0];
	if (!genre) throw new Error("No reading-story genre is configured.");
	const preferences = {
		prefer: learner.preferences.prefer,
		avoid: learner.preferences.avoid,
	};
	const steps: StoryChainStep[] = [];
	let inputBrief = STARTER_NEXT_STORY_BRIEF;
	let explicitTheme = "";
	for (let index = 0; index < options.length; index += 1) {
		process.stderr.write(
			`Generating story ${index + 1}/${options.length}...\n`,
		);
		const story = await generateStoryWithRetries(
			() =>
				generateReadingStory(complete, genre, preferences, explicitTheme, {
					reasoningEffort: options.reasoningEffort,
					nextStoryBrief: inputBrief,
				}),
			options.retries,
			index + 1,
		);
		const feedback = feedbackItems[index] ?? { difficulty: "right" };
		const nextStoryBrief = await generateNextStoryBrief(
			openai,
			evidenceFor(story, feedback),
			anthropicKey,
		);
		const step = {
			index: index + 1,
			inputBrief,
			explicitTheme,
			story,
			feedback,
			nextStoryBrief,
		};
		steps.push(step);
		onStep?.(step);
		inputBrief = nextStoryBrief;
		explicitTheme = feedback.nextStoryTheme?.trim() ?? "";
	}
	return steps;
}

async function generateStoryWithRetries(
	generate: () => Promise<ReadingStory>,
	retries: number,
	storyIndex: number,
): Promise<ReadingStory> {
	for (let attempt = 0; ; attempt += 1) {
		try {
			return await generate();
		} catch (error) {
			if (attempt >= retries) throw error;
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(
				`Story ${storyIndex} was rejected (${message}); retrying ${attempt + 1}/${retries}...\n`,
			);
		}
	}
}

function formatReadable(steps: StoryChainStep[]): string {
	return `${steps
		.map((step) => {
			const parts = step.story.parts
				.map((part, index) => `Part ${index + 1}:\n${part.text}`)
				.join("\n\n");
			return [
				`${"=".repeat(72)}\nSTORY ${step.index}: ${step.story.title}`,
				`Input brief:\n${JSON.stringify(step.inputBrief, null, 2)}`,
				step.explicitTheme
					? `Explicit next-theme override:\n${step.explicitTheme}`
					: "Explicit next-theme override: (none)",
				`Plot summary:\n${step.story.storySummary}`,
				`Language focus:\n${step.story.languageFocus}`,
				parts,
				`Simulated learner feedback:\n${JSON.stringify(step.feedback, null, 2)}`,
				`Generated handoff to story ${step.index + 1}:\n${JSON.stringify(step.nextStoryBrief, null, 2)}`,
			].join("\n\n");
		})
		.join("\n\n")}\n`;
}

export async function runStoryChainCli(rawArgs: string[]): Promise<void> {
	const options = parseStoryChainCliArgs(rawArgs);
	if (options.help) {
		process.stdout.write(HELP);
		return;
	}
	const learner = await loadCliLearnerContext(options);
	const feedback = await loadChainFeedback(
		options.feedbackPath,
		options.length,
	);
	const steps = await simulateChain(
		options,
		learner,
		feedback,
		options.json
			? undefined
			: (step) => process.stdout.write(formatReadable([step])),
	);
	if (options.json) process.stdout.write(`${JSON.stringify(steps, null, 2)}\n`);
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
