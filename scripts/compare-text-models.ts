/**
 * Compare text models on beginner Esperanto reading-story generation.
 *
 * Pricing references checked on 2026-07-01:
 * - OpenAI: https://developers.openai.com/api/docs/pricing
 * - Anthropic: https://platform.claude.com/docs/en/about-claude/pricing
 * - Gemini: https://ai.google.dev/gemini-api/docs/pricing
 */
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { TEXT_MODELS, type TextModelId } from "../src/models.ts";
import { normalizeStoryText } from "../src/server/http.ts";
import {
	type ChatMessage,
	type ReadingStoryFrame,
	readingPartMessages,
} from "../src/story.ts";

type Provider = "openai" | "anthropic" | "gemini";

type Usage = {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
};

type CompletionResult = {
	text: string;
	finishReason: string | null;
	usage: Usage;
	costUsd: number;
	attempts: number;
};

type RunRecord = {
	kind: "generation";
	frameId: string;
	repeatIndex: number;
	partNumber: number;
	model: TextModelId;
	provider: Provider;
	latencyMs: number;
	text: string;
	finishReason: string | null;
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	estimatedCostUsd: number;
	attempts?: number;
	error?: string;
};

type StoryCandidate = {
	id: string;
	frameId: string;
	repeatIndex: number;
	model: TextModelId;
	provider: Provider;
	parts: string[];
	runs: RunRecord[];
	totalCostUsd: number;
	totalLatencyMs: number;
	failed: boolean;
};

type DeterministicScore = {
	score: number;
	checks: {
		esperantoOnly: number;
		noMarkup: number;
		sentenceCount: number;
		noPrefixRepeat: number;
		beatCoverage: number;
		beginnerSimplicity: number;
	};
	notes: string[];
};

type JudgeScore = {
	esperantoNaturalness: number;
	beginnerSuitability: number;
	beatAdherence: number;
	continuity: number;
	typingPracticeUsefulness: number;
	notes: string;
};

type CandidateScore = {
	candidateId: string;
	frameId: string;
	model: TextModelId;
	provider: Provider;
	repeatIndex: number;
	deterministic: DeterministicScore;
	judge: JudgeScore | null;
	qualityScore: number;
	costEfficiencyScore: number;
	totalCostUsd: number;
	totalLatencyMs: number;
};

type ModelSummary = {
	model: TextModelId;
	provider: Provider;
	runs: number;
	averageQuality: number;
	averageCostUsd: number;
	totalCostUsd: number;
	medianLatencyMs: number;
	costEfficiencyScore: number;
};

type AnthropicMessage = {
	role: "user" | "assistant";
	content: string;
};

type GeminiContent = {
	role: "user" | "model";
	parts: Array<{ text: string }>;
};

type GeminiGenerateContentResponse = {
	candidates?: Array<{
		content?: {
			parts?: Array<{ text?: string }>;
		};
		finishReason?: string;
	}>;
	usageMetadata?: {
		promptTokenCount?: number;
		candidatesTokenCount?: number;
		totalTokenCount?: number;
	};
};

const ALL_BENCHMARK_MODELS = [
	"gpt-5.4-mini",
	"gpt-5.4",
	"gpt-5.5",
	"claude-sonnet-4-6",
	"claude-sonnet-5",
	"gemini-3.5-flash",
	"gemini-3.1-pro-preview",
	"gemini-2.5-pro",
	"gemini-2.5-flash",
] satisfies TextModelId[];

const DEFAULT_REPEATS = 2;
const STORY_PARTS = 6;
const STORY_PART_MAX_TOKENS = 700;
const OPENAI_EMPTY_RETRY_MAX_TOKENS = 1200;
const JUDGE_MODEL = "gpt-5.5";

const PRICE_PER_MILLION_TOKENS: Record<
	TextModelId,
	{ input: number; output: number }
> = {
	"gpt-5.4-mini": { input: 0.75, output: 4.5 },
	"gpt-5.4": { input: 2.5, output: 15 },
	"gpt-5.5": { input: 5, output: 30 },
	"claude-sonnet-4-6": { input: 3, output: 15 },
	"claude-sonnet-5": { input: 2, output: 10 },
	"gemini-3.5-flash": { input: 1.5, output: 9 },
	"gemini-3.1-pro-preview": { input: 2.7, output: 16.2 },
	"gemini-2.5-pro": { input: 1.25, output: 10 },
	"gemini-2.5-flash": { input: 0.3, output: 2.5 },
};

const BENCHMARK_FRAMES: Array<ReadingStoryFrame & { id: string }> = [
	{
		id: "fresh-rolls",
		totalParts: 6,
		level: "beginner",
		premise:
			"A young baker tries to deliver warm rolls to a neighbor before the rain starts.",
		mainCharacter: "Toma, a kind young baker",
		mainCharacterVisual:
			"Teenage boy with a round face, short dark hair, a blue apron over a cream shirt, brown trousers, a woven bread basket, and a small red scarf tied to the basket handle",
		setting:
			"A small town with a bakery, a quiet street, and a nearby apartment house",
		beats: [
			{
				part: 1,
				role: "beginning",
				summary:
					"Toma works in his bakery early in the morning and packs fresh rolls into a basket.",
				languageFocus: "Simple present tense, basic action verbs, food words",
			},
			{
				part: 2,
				role: "inciting event",
				summary:
					"An old neighbor arrives and asks Toma to bring warm rolls to her apartment before the rain starts.",
				languageFocus:
					"Polite requests, simple time words, transportation vocabulary",
			},
			{
				part: 3,
				role: "first attempt",
				summary:
					"Toma leaves the bakery and walks quickly down the street with the basket, looking at the dark clouds.",
				languageFocus: "Movement verbs, weather words, prepositions of place",
			},
			{
				part: 4,
				role: "complication",
				summary:
					"Heavy rain begins, and Toma sees that the road near the park is muddy and slippery.",
				languageFocus:
					"Weather sentences, describing problems, simple adjectives",
			},
			{
				part: 5,
				role: "resolution attempt",
				summary:
					"Toma chooses a covered path between buildings, protects the basket with his coat, and reaches the apartment house.",
				languageFocus:
					"Giving directions, problem-solving phrases, protective actions",
			},
			{
				part: 6,
				role: "ending",
				summary:
					"The neighbor thanks Toma and shares one warm roll with him as the rain falls outside.",
				languageFocus:
					"Gratitude expressions, sharing language, simple past tense",
			},
		],
	},
	{
		id: "garden-key",
		totalParts: 6,
		level: "beginner",
		premise:
			"A child finds a lost key in a garden and tries to return it to the right neighbor.",
		mainCharacter: "Lina, a careful child",
		mainCharacterVisual:
			"Young child with shoulder-length brown hair, a green sweater, yellow rain boots, a small cloth bag, and a bright copper key on a blue ribbon",
		setting:
			"A quiet shared garden behind three small houses, with a bench, flowers, and open windows",
		beats: [
			{
				part: 1,
				role: "beginning",
				summary:
					"Lina walks in the garden and sees a small copper key near the flowers.",
				languageFocus:
					"Simple present tense, seeing and finding verbs, garden words",
			},
			{
				part: 2,
				role: "inciting event",
				summary:
					"Lina asks whose key it is and decides to visit the nearby houses.",
				languageFocus: "Questions, possession words, simple decisions",
			},
			{
				part: 3,
				role: "first attempt",
				summary:
					"Lina knocks on the blue door, but the key does not belong to that family.",
				languageFocus: "House vocabulary, negation, polite speech",
			},
			{
				part: 4,
				role: "complication",
				summary:
					"A window closes in the wind, and Lina worries that the owner may be away.",
				languageFocus: "Weather and sound words, simple worry phrases",
			},
			{
				part: 5,
				role: "resolution attempt",
				summary:
					"Lina notices a blue ribbon on the key and matches it to a blue bag by the bench.",
				languageFocus: "Colors, matching, location phrases, problem solving",
			},
			{
				part: 6,
				role: "ending",
				summary:
					"The neighbor thanks Lina, opens the garden shed, and gives Lina a flower.",
				languageFocus: "Gratitude, simple past tense, giving and receiving",
			},
		],
	},
	{
		id: "library-cat",
		totalParts: 6,
		level: "beginner",
		premise:
			"A young library helper follows a quiet cat to find a missing picture book.",
		mainCharacter: "Niko, a patient library helper",
		mainCharacterVisual:
			"Teenage helper with curly black hair, round glasses, a gray vest over a white shirt, dark trousers, a stack of picture books, and a pencil behind one ear",
		setting:
			"A small town library with low shelves, a reading rug, a sunny window, and a children's corner",
		beats: [
			{
				part: 1,
				role: "beginning",
				summary:
					"Niko puts books on shelves and sees that one picture book is missing.",
				languageFocus: "Library nouns, simple present, counting words",
			},
			{
				part: 2,
				role: "inciting event",
				summary:
					"A quiet cat walks past Niko with a paper bookmark in its mouth.",
				languageFocus: "Animal words, movement verbs, object descriptions",
			},
			{
				part: 3,
				role: "first attempt",
				summary:
					"Niko follows the cat slowly between the shelves and calls softly.",
				languageFocus: "Prepositions, slow movement, adverbs",
			},
			{
				part: 4,
				role: "complication",
				summary:
					"The cat hides under a chair, and Niko cannot see the missing book.",
				languageFocus: "Negation, furniture words, problem sentences",
			},
			{
				part: 5,
				role: "resolution attempt",
				summary:
					"Niko sees the book behind the chair, picks it up, and thanks the cat.",
				languageFocus: "Finding, locations, thanks, simple actions",
			},
			{
				part: 6,
				role: "ending",
				summary:
					"Niko returns the book to the children's corner, and children read it together.",
				languageFocus: "Simple past tense, together words, reading verbs",
			},
		],
	},
];

const EXPECTED_BEAT_TERMS: Record<string, string[][]> = {
	"fresh-rolls": [
		["Toma", "bakej", "bulk", "korb"],
		["najbar", "bonvol", "port", "pluv"],
		["elir", "strat", "nub", "rapid"],
		["pluv", "park", "kot", "glit"],
		["kovrit", "inter", "mantel", "dom"],
		["dank", "don", "manĝ", "ekster"],
	],
	"garden-key": [
		["Lina", "ĝarden", "ŝlosil", "flor"],
		["kies", "dom", "demand", "decid"],
		["pord", "frap", "ne", "famili"],
		["fenestr", "vent", "zorg", "for"],
		["ruband", "blu", "benk", "sako"],
		["dank", "malferm", "don", "flor"],
	],
	"library-cat": [
		["Niko", "bibliotek", "libr", "bret"],
		["kat", "paper", "buŝ", "paŝ"],
		["sekv", "malrapid", "inter", "vok"],
		["kaŝ", "seĝ", "ne", "vid"],
		["malantaŭ", "pren", "dank", "kat"],
		["infan", "leg", "kune", "angul"],
	],
};

const COMMON_ENGLISH_WORDS = [
	"the",
	"and",
	"with",
	"before",
	"after",
	"story",
	"part",
	"chapter",
	"because",
	"then",
	"outside",
	"inside",
	"thanks",
	"please",
];

const MARKUP_PATTERNS = [
	/^#+\s/m,
	/```/,
	/\*\*/,
	/^part\s+\d/im,
	/^section\s+\d/im,
];

const args = process.argv.slice(2);
const options = parseArgs(args);
const runStartedAt = new Date();
const runId = runStartedAt.toISOString().replace(/[:.]/g, "-");
const outputDir = join(".artifacts", "model-comparison", runId);

const selectedModels = parseModels(options.models);
const selectedFrames = parseFrames(options.frames);
const repeats = options.smoke ? 1 : options.repeats;

if (options.dryRun) {
	await runDryRun();
} else {
	await runBenchmark();
}

async function runDryRun() {
	await mkdir(outputDir, { recursive: true });
	const payload = {
		runId,
		outputDir,
		models: selectedModels,
		frames: selectedFrames.map((frame) => frame.id),
		repeats,
		storyParts: STORY_PARTS,
		judgeModel: JUDGE_MODEL,
		pricing: PRICE_PER_MILLION_TOKENS,
	};
	await writeFile(
		join(outputDir, "dry-run.json"),
		`${JSON.stringify(payload, null, 2)}\n`,
	);
	console.log("Model comparison dry run ok.");
	console.log(`Output directory: ${outputDir}`);
	console.log(`Models: ${selectedModels.join(", ")}`);
	console.log(`Frames: ${selectedFrames.map((frame) => frame.id).join(", ")}`);
	console.log(`Repeats: ${repeats}`);
}

async function runBenchmark() {
	const keys = getApiKeys();
	await mkdir(outputDir, { recursive: true });
	const runsPath = join(outputDir, "runs.jsonl");
	const openai = new OpenAI({ apiKey: keys.openai });
	const anthropic = new Anthropic({ apiKey: keys.anthropic });
	const candidates: StoryCandidate[] = [];
	let candidateCostUsd = 0;
	let judgeCostUsd = 0;

	console.log(`Writing model comparison artifacts to ${outputDir}`);

	for (const frame of selectedFrames) {
		for (const model of selectedModels) {
			for (let repeatIndex = 0; repeatIndex < repeats; repeatIndex++) {
				const candidate = await generateCandidate({
					anthropic,
					frame,
					model,
					openai,
					repeatIndex,
					runsPath,
				});
				candidates.push(candidate);
				candidateCostUsd += candidate.totalCostUsd;
				const status = candidate.failed ? "failed" : "ok";
				console.log(
					`${candidate.id}: ${status}, ${formatCurrency(candidate.totalCostUsd)}, ${candidate.totalLatencyMs}ms`,
				);
			}
		}
	}

	const scores: CandidateScore[] = [];
	for (const candidate of candidates.filter((item) => !item.failed)) {
		const deterministic = scoreDeterministic(candidate);
		const judged = await judgeCandidate(openai, candidate);
		judgeCostUsd += judged.costUsd;
		const judge = judged.score;
		const qualityScore = combinedQualityScore(deterministic, judge);
		const score: CandidateScore = {
			candidateId: candidate.id,
			frameId: candidate.frameId,
			model: candidate.model,
			provider: candidate.provider,
			repeatIndex: candidate.repeatIndex,
			deterministic,
			judge,
			qualityScore,
			costEfficiencyScore:
				qualityScore / Math.max(candidate.totalCostUsd, 0.000001),
			totalCostUsd: candidate.totalCostUsd,
			totalLatencyMs: candidate.totalLatencyMs,
		};
		scores.push(score);
		console.log(
			`Scored ${candidate.id}: ${qualityScore.toFixed(2)} quality, ${formatCurrency(candidate.totalCostUsd)}`,
		);
	}

	const summaries = summarizeModels(scores);
	const summary = buildSummary({
		candidates,
		candidateCostUsd,
		judgeCostUsd,
		scores,
		summaries,
	});
	await writeFile(
		join(outputDir, "scores.json"),
		`${JSON.stringify({ scores, summaries }, null, 2)}\n`,
	);
	await writeFile(join(outputDir, "summary.md"), summary);

	const bestQuality = [...summaries].sort(
		(a, b) => b.averageQuality - a.averageQuality,
	)[0];
	const bestValue = [...summaries].sort(
		(a, b) => b.costEfficiencyScore - a.costEfficiencyScore,
	)[0];
	console.log("\nModel comparison complete.");
	console.log(`Summary: ${join(outputDir, "summary.md")}`);
	if (bestQuality) {
		console.log(
			`Best quality: ${bestQuality.model} (${bestQuality.averageQuality.toFixed(2)})`,
		);
	}
	if (bestValue) {
		console.log(
			`Best value: ${bestValue.model} (${bestValue.costEfficiencyScore.toFixed(1)} quality/USD)`,
		);
	}
	console.log(`Candidate generation cost: ${formatCurrency(candidateCostUsd)}`);
	console.log(`Judge cost: ${formatCurrency(judgeCostUsd)}`);
}

async function generateCandidate({
	anthropic,
	frame,
	model,
	openai,
	repeatIndex,
	runsPath,
}: {
	anthropic: Anthropic;
	frame: ReadingStoryFrame & { id: string };
	model: TextModelId;
	openai: OpenAI;
	repeatIndex: number;
	runsPath: string;
}): Promise<StoryCandidate> {
	const provider = providerForModel(model);
	const parts: string[] = [];
	const runs: RunRecord[] = [];
	const id = `${frame.id}__${model}__r${repeatIndex + 1}`;

	for (let partNumber = 1; partNumber <= STORY_PARTS; partNumber++) {
		const messages = readingPartMessages(frame, partNumber, parts);
		const startedAt = performance.now();
		try {
			const result = await completeWithUsage({
				anthropic,
				messages,
				model,
				openai,
				maxTokens: STORY_PART_MAX_TOKENS,
			});
			const latencyMs = Math.round(performance.now() - startedAt);
			parts.push(result.text);
			const record: RunRecord = {
				kind: "generation",
				frameId: frame.id,
				repeatIndex,
				partNumber,
				model,
				provider,
				latencyMs,
				text: result.text,
				finishReason: result.finishReason,
				inputTokens: result.usage.inputTokens,
				outputTokens: result.usage.outputTokens,
				totalTokens: result.usage.totalTokens,
				estimatedCostUsd: result.costUsd,
				attempts: result.attempts,
			};
			runs.push(record);
			await appendJsonl(runsPath, record);
		} catch (error) {
			const latencyMs = Math.round(performance.now() - startedAt);
			const record: RunRecord = {
				kind: "generation",
				frameId: frame.id,
				repeatIndex,
				partNumber,
				model,
				provider,
				latencyMs,
				text: "",
				finishReason: null,
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
				estimatedCostUsd: 0,
				error: error instanceof Error ? error.message : String(error),
			};
			runs.push(record);
			await appendJsonl(runsPath, record);
			break;
		}
	}

	return {
		id,
		frameId: frame.id,
		repeatIndex,
		model,
		provider,
		parts,
		runs,
		totalCostUsd: sum(runs.map((run) => run.estimatedCostUsd)),
		totalLatencyMs: sum(runs.map((run) => run.latencyMs)),
		failed: parts.length !== STORY_PARTS,
	};
}

async function completeWithUsage({
	anthropic,
	messages,
	model,
	openai,
	maxTokens,
}: {
	anthropic: Anthropic;
	messages: ChatMessage[];
	model: TextModelId;
	openai: OpenAI;
	maxTokens: number;
}): Promise<CompletionResult> {
	if (model.startsWith("claude-")) {
		return completeAnthropicWithUsage(anthropic, messages, maxTokens, model);
	}
	if (model.startsWith("gemini-")) {
		return completeGeminiWithUsage(messages, maxTokens, model);
	}
	return completeOpenAiWithUsage(openai, messages, maxTokens, model);
}

async function completeOpenAiWithUsage(
	openai: OpenAI,
	messages: ChatMessage[],
	maxTokens: number,
	model: TextModelId,
): Promise<CompletionResult> {
	const requestTokenBudgets = [maxTokens, OPENAI_EMPTY_RETRY_MAX_TOKENS];
	let usage: Usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
	let finishReason: string | null = null;

	for (const [index, tokenBudget] of requestTokenBudgets.entries()) {
		const response = await openai.chat.completions.create({
			model,
			max_completion_tokens: tokenBudget,
			messages,
		});
		const choice = response.choices[0];
		finishReason = choice?.finish_reason ?? null;
		const attemptUsage = {
			inputTokens: response.usage?.prompt_tokens ?? 0,
			outputTokens: response.usage?.completion_tokens ?? 0,
			totalTokens: response.usage?.total_tokens ?? 0,
		};
		usage = addUsage(usage, attemptUsage);
		const raw = choice?.message?.content?.trim();
		if (raw) {
			return {
				text: normalizeCompletionText(raw, finishReason),
				finishReason,
				usage,
				costUsd: estimateCost(model, usage),
				attempts: index + 1,
			};
		}
	}

	throw new Error(
		`OpenAI returned empty visible text after ${requestTokenBudgets.length} attempts; last finish_reason=${finishReason ?? "unknown"}; billed tokens=${usage.totalTokens}`,
	);
}

async function completeAnthropicWithUsage(
	anthropic: Anthropic,
	messages: ChatMessage[],
	maxTokens: number,
	model: TextModelId,
): Promise<CompletionResult> {
	const { systemContent, conversationMessages } = toAnthropicMessages(messages);
	const response = await anthropic.messages.create({
		model,
		max_tokens: maxTokens,
		...(systemContent ? { system: systemContent } : {}),
		messages: conversationMessages,
	});
	const block = response.content[0];
	if (block?.type !== "text")
		throw new Error("Anthropic returned an empty response.");
	const usage = {
		inputTokens: response.usage.input_tokens,
		outputTokens: response.usage.output_tokens,
		totalTokens: response.usage.input_tokens + response.usage.output_tokens,
	};
	return {
		text: normalizeCompletionText(block.text, response.stop_reason),
		finishReason: response.stop_reason,
		usage,
		costUsd: estimateCost(model, usage),
		attempts: 1,
	};
}

async function completeGeminiWithUsage(
	messages: ChatMessage[],
	maxTokens: number,
	model: TextModelId,
): Promise<CompletionResult> {
	const apiKey = process.env.GEMINI_API_KEY ?? "";
	if (!apiKey) throw new Error("GEMINI_API_KEY is required for Gemini models.");
	const { systemContent, conversationMessages } = toGeminiMessages(messages);
	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-goog-api-key": apiKey,
			},
			body: JSON.stringify({
				contents: conversationMessages,
				generationConfig: { maxOutputTokens: maxTokens },
				...(systemContent
					? { systemInstruction: { parts: [{ text: systemContent }] } }
					: {}),
			}),
		},
	);
	if (!response.ok) {
		throw new Error(
			`Gemini request failed: ${response.status} ${response.statusText}: ${await response.text()}`,
		);
	}
	const json = (await response.json()) as GeminiGenerateContentResponse;
	const choice = json.candidates?.[0];
	const raw = choice?.content?.parts
		?.map((part) => part.text ?? "")
		.join("")
		.trim();
	if (!raw) throw new Error("Gemini returned an empty response.");
	const usage = {
		inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
		outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
		totalTokens: json.usageMetadata?.totalTokenCount ?? 0,
	};
	return {
		text: normalizeCompletionText(raw, choice?.finishReason ?? null),
		finishReason: choice?.finishReason ?? null,
		usage,
		costUsd: estimateCost(model, usage),
		attempts: 1,
	};
}

async function judgeCandidate(
	openai: OpenAI,
	candidate: StoryCandidate,
): Promise<{ score: JudgeScore | null; costUsd: number }> {
	const frame = BENCHMARK_FRAMES.find((candidateFrame) => {
		return candidateFrame.id === candidate.frameId;
	});
	if (!frame) throw new Error(`Unknown frame for judge: ${candidate.frameId}`);

	const prompt = {
		frame,
		candidate: {
			label: "Candidate A",
			parts: candidate.parts,
		},
		rubric:
			"Score each field from 1 to 5. Reward natural Esperanto, beginner suitability, exact beat adherence without repeating previous parts, continuity, and usefulness as typing practice. Return only JSON.",
	};

	const response = await openai.chat.completions.create({
		model: JUDGE_MODEL,
		max_completion_tokens: 500,
		messages: [
			{
				role: "system",
				content:
					"You are a strict evaluator for beginner Esperanto reading stories. Return only valid JSON with numeric scores and notes.",
			},
			{
				role: "user",
				content: JSON.stringify(prompt, null, 2),
			},
		],
	});
	const usage = {
		inputTokens: response.usage?.prompt_tokens ?? 0,
		outputTokens: response.usage?.completion_tokens ?? 0,
		totalTokens: response.usage?.total_tokens ?? 0,
	};
	const raw = response.choices[0]?.message?.content?.trim() ?? "";
	const score = parseJudgeScore(raw);
	return { score, costUsd: estimateCost(JUDGE_MODEL, usage) };
}

function parseJudgeScore(raw: string): JudgeScore | null {
	try {
		const parsed = JSON.parse(extractJsonObject(raw)) as Partial<JudgeScore>;
		return {
			esperantoNaturalness: clampScore(parsed.esperantoNaturalness),
			beginnerSuitability: clampScore(parsed.beginnerSuitability),
			beatAdherence: clampScore(parsed.beatAdherence),
			continuity: clampScore(parsed.continuity),
			typingPracticeUsefulness: clampScore(parsed.typingPracticeUsefulness),
			notes: typeof parsed.notes === "string" ? parsed.notes : "",
		};
	} catch {
		return null;
	}
}

function scoreDeterministic(candidate: StoryCandidate): DeterministicScore {
	const notes: string[] = [];
	const allText = candidate.parts.join("\n");
	const englishHits = COMMON_ENGLISH_WORDS.filter((word) => {
		return new RegExp(`\\b${word}\\b`, "i").test(allText);
	});
	const markupHits = MARKUP_PATTERNS.filter((pattern) => pattern.test(allText));
	const sentenceScores = candidate.parts.map(scoreSentenceCount);
	const prefixScores = candidate.parts.map((part, index) =>
		index === 0
			? 1
			: scoreNoPrefixRepeat(part, candidate.parts[index - 1] ?? ""),
	);
	const coverageScores = candidate.parts.map((part, index) =>
		scoreBeatCoverage(candidate.frameId, index, part),
	);
	const simplicityScores = candidate.parts.map(scoreBeginnerSimplicity);

	if (englishHits.length > 0)
		notes.push(`English-looking words: ${englishHits}`);
	if (markupHits.length > 0) notes.push("Markup or heading pattern detected.");

	const checks = {
		esperantoOnly: englishHits.length === 0 ? 1 : 0,
		noMarkup: markupHits.length === 0 ? 1 : 0,
		sentenceCount: average(sentenceScores),
		noPrefixRepeat: average(prefixScores),
		beatCoverage: average(coverageScores),
		beginnerSimplicity: average(simplicityScores),
	};

	const score =
		checks.esperantoOnly * 0.15 +
		checks.noMarkup * 0.1 +
		checks.sentenceCount * 0.15 +
		checks.noPrefixRepeat * 0.2 +
		checks.beatCoverage * 0.25 +
		checks.beginnerSimplicity * 0.15;

	return { score: score * 5, checks, notes };
}

function scoreSentenceCount(text: string): number {
	const count = splitSentences(text).length;
	if (count >= 3 && count <= 5) return 1;
	if (count === 2 || count === 6) return 0.65;
	return 0.25;
}

function scoreNoPrefixRepeat(text: string, previous: string): number {
	const normalizedText = normalizeForComparison(text);
	const normalizedPrevious = normalizeForComparison(previous);
	if (!normalizedText || !normalizedPrevious) return 1;
	if (normalizedText.startsWith(normalizedPrevious.slice(0, 80))) return 0;
	const textStart = normalizedText.slice(0, 120);
	const previousStart = normalizedPrevious.slice(0, 120);
	return similarity(textStart, previousStart) > 0.8 ? 0.25 : 1;
}

function scoreBeatCoverage(
	frameId: string,
	partIndex: number,
	text: string,
): number {
	const terms = EXPECTED_BEAT_TERMS[frameId]?.[partIndex] ?? [];
	if (terms.length === 0) return 0.75;
	const normalized = text.toLocaleLowerCase();
	const hits = terms.filter((term) =>
		normalized.includes(term.toLocaleLowerCase()),
	).length;
	return hits / terms.length;
}

function scoreBeginnerSimplicity(text: string): number {
	const sentences = splitSentences(text);
	const words = text.match(/[\p{L}'-]+/gu) ?? [];
	const averageSentenceWords =
		sentences.length > 0 ? words.length / sentences.length : words.length;
	const uniqueRatio =
		new Set(words.map((word) => word.toLowerCase())).size /
		Math.max(words.length, 1);
	const punctuationPenalty = /[;:()]/.test(text) ? 0.15 : 0;
	const lengthScore =
		averageSentenceWords <= 9 ? 1 : averageSentenceWords <= 13 ? 0.7 : 0.35;
	const repetitionScore =
		uniqueRatio <= 0.78 ? 1 : uniqueRatio <= 0.88 ? 0.7 : 0.4;
	return Math.max(
		0,
		lengthScore * 0.65 + repetitionScore * 0.35 - punctuationPenalty,
	);
}

function combinedQualityScore(
	deterministic: DeterministicScore,
	judge: JudgeScore | null,
) {
	if (!judge) return deterministic.score;
	const judgeAverage = average([
		judge.esperantoNaturalness,
		judge.beginnerSuitability,
		judge.beatAdherence,
		judge.continuity,
		judge.typingPracticeUsefulness,
	]);
	return deterministic.score * 0.4 + judgeAverage * 0.6;
}

function summarizeModels(scores: CandidateScore[]): ModelSummary[] {
	return selectedModels.map((model) => {
		const modelScores = scores.filter((score) => score.model === model);
		const latencies = modelScores.map((score) => score.totalLatencyMs);
		const totalCostUsd = sum(modelScores.map((score) => score.totalCostUsd));
		const averageQuality = average(
			modelScores.map((score) => score.qualityScore),
		);
		const averageCostUsd = average(
			modelScores.map((score) => score.totalCostUsd),
		);
		return {
			model,
			provider: providerForModel(model),
			runs: modelScores.length,
			averageQuality,
			averageCostUsd,
			totalCostUsd,
			medianLatencyMs: median(latencies),
			costEfficiencyScore: averageQuality / Math.max(averageCostUsd, 0.000001),
		};
	});
}

function buildSummary({
	candidates,
	candidateCostUsd,
	judgeCostUsd,
	scores,
	summaries,
}: {
	candidates: StoryCandidate[];
	candidateCostUsd: number;
	judgeCostUsd: number;
	scores: CandidateScore[];
	summaries: ModelSummary[];
}) {
	const byQuality = [...summaries].sort(
		(a, b) => b.averageQuality - a.averageQuality,
	);
	const byValue = [...summaries].sort(
		(a, b) => b.costEfficiencyScore - a.costEfficiencyScore,
	);
	const byBalanced = [...summaries].sort((a, b) => {
		const aScore =
			a.averageQuality * 0.75 + normalizeValue(a, summaries) * 1.25;
		const bScore =
			b.averageQuality * 0.75 + normalizeValue(b, summaries) * 1.25;
		return bScore - aScore;
	});
	const representative = pickRepresentativeSamples(candidates, scores);
	const failedCandidates = candidates.filter((candidate) => candidate.failed);

	return [
		"# Text Model Comparison",
		"",
		`Generated at: ${runStartedAt.toISOString()}`,
		`Frames: ${selectedFrames.map((frame) => frame.id).join(", ")}`,
		`Repeats per model/frame: ${repeats}`,
		`Candidate generation cost: ${formatCurrency(candidateCostUsd)}`,
		`Judge cost, excluded from candidate cost: ${formatCurrency(judgeCostUsd)}`,
		"",
		"## Winners",
		"",
		`- Best quality: ${byQuality[0]?.model ?? "n/a"}`,
		`- Best low-cost result: ${byValue[0]?.model ?? "n/a"}`,
		`- Best balanced: ${byBalanced[0]?.model ?? "n/a"}`,
		"",
		"## Ranking By Quality",
		"",
		formatSummaryTable(byQuality),
		"",
		"## Ranking By Cost Efficiency",
		"",
		formatSummaryTable(byValue),
		"",
		"## Representative Samples",
		"",
		...representative.flatMap(({ candidate, score }) => [
			`### ${candidate.model} / ${candidate.frameId} / repeat ${candidate.repeatIndex + 1}`,
			"",
			`Quality: ${score.qualityScore.toFixed(2)} | Cost: ${formatCurrency(candidate.totalCostUsd)} | Latency: ${candidate.totalLatencyMs}ms`,
			"",
			candidate.parts.join("\n\n"),
			"",
		]),
		...(failedCandidates.length > 0
			? [
					"## Failed Candidates",
					"",
					...failedCandidates.map((candidate) => {
						const failedRun = candidate.runs.find((run) => run.error);
						return `- ${candidate.id}: stopped after ${candidate.parts.length}/${STORY_PARTS} parts. ${failedRun?.error ?? "Unknown error."}`;
					}),
					"",
				]
			: []),
	].join("\n");
}

function formatSummaryTable(summaries: ModelSummary[]) {
	return [
		"| Model | Provider | Runs | Avg quality | Avg cost | Total cost | Median latency | Quality/USD |",
		"| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
		...summaries.map(
			(summary) =>
				`| ${[
					summary.model,
					summary.provider,
					String(summary.runs),
					summary.averageQuality.toFixed(2),
					formatCurrency(summary.averageCostUsd),
					formatCurrency(summary.totalCostUsd),
					`${summary.medianLatencyMs}ms`,
					summary.costEfficiencyScore.toFixed(1),
				].join(" | ")} |`,
		),
	].join("\n");
}

function pickRepresentativeSamples(
	candidates: StoryCandidate[],
	scores: CandidateScore[],
) {
	return selectedModels.flatMap((model) => {
		const modelScores = scores
			.filter((score) => score.model === model)
			.sort((a, b) => b.qualityScore - a.qualityScore);
		const top = modelScores[0];
		const candidate = candidates.find((item) => item.id === top?.candidateId);
		return top && candidate ? [{ candidate, score: top }] : [];
	});
}

function normalizeValue(summary: ModelSummary, summaries: ModelSummary[]) {
	const values = summaries.map((item) => item.costEfficiencyScore);
	const min = Math.min(...values);
	const max = Math.max(...values);
	if (max === min) return 1;
	return ((summary.costEfficiencyScore - min) / (max - min)) * 5;
}

function parseArgs(rawArgs: string[]) {
	const parsed = {
		dryRun: rawArgs.includes("--dry-run"),
		smoke: rawArgs.includes("--smoke"),
		repeats: numberFlag(rawArgs, "--repeats") ?? DEFAULT_REPEATS,
		models: stringFlag(rawArgs, "--models"),
		frames: stringFlag(rawArgs, "--frames"),
	};
	if (parsed.smoke) {
		parsed.models ??= "gpt-5.4-mini,gemini-2.5-flash";
		parsed.frames ??= "fresh-rolls";
	}
	return parsed;
}

function parseModels(rawModels?: string): TextModelId[] {
	const modelIds = new Set(TEXT_MODELS.map((model) => model.id));
	const models = rawModels
		? rawModels.split(",").map((model) => model.trim())
		: ALL_BENCHMARK_MODELS;
	for (const model of models) {
		if (!modelIds.has(model as TextModelId)) {
			throw new Error(`Unknown model "${model}".`);
		}
		if (!ALL_BENCHMARK_MODELS.includes(model as TextModelId)) {
			throw new Error(`Model "${model}" is not in the benchmark model set.`);
		}
	}
	return models as TextModelId[];
}

function parseFrames(rawFrames?: string) {
	if (!rawFrames) return BENCHMARK_FRAMES;
	const requested = rawFrames.split(",").map((frame) => frame.trim());
	const frames = requested.map((id) => {
		const frame = BENCHMARK_FRAMES.find((candidate) => candidate.id === id);
		if (!frame) throw new Error(`Unknown frame "${id}".`);
		return frame;
	});
	return frames;
}

function numberFlag(rawArgs: string[], flag: string) {
	const index = rawArgs.indexOf(flag);
	if (index === -1) return null;
	const value = Number.parseInt(rawArgs[index + 1] ?? "", 10);
	if (!Number.isFinite(value) || value < 1) {
		throw new Error(`${flag} requires a positive integer.`);
	}
	return value;
}

function stringFlag(rawArgs: string[], flag: string) {
	const index = rawArgs.indexOf(flag);
	if (index === -1) return undefined;
	const value = rawArgs[index + 1]?.trim();
	if (!value) throw new Error(`${flag} requires a value.`);
	return value;
}

function getApiKeys() {
	const openai = process.env.OPENAI_API_KEY ?? "";
	const anthropic = process.env.ANTHROPIC_API_KEY ?? "";
	const gemini = process.env.GEMINI_API_KEY ?? "";
	if (selectedModels.some((model) => model.startsWith("gpt-")) && !openai) {
		throw new Error("OPENAI_API_KEY is required for OpenAI models.");
	}
	if (
		selectedModels.some((model) => model.startsWith("claude-")) &&
		!anthropic
	) {
		throw new Error("ANTHROPIC_API_KEY is required for Claude models.");
	}
	if (selectedModels.some((model) => model.startsWith("gemini-")) && !gemini) {
		throw new Error("GEMINI_API_KEY is required for Gemini models.");
	}
	if (!openai) {
		throw new Error("OPENAI_API_KEY is required for judge scoring.");
	}
	return { openai, anthropic, gemini };
}

function providerForModel(model: TextModelId): Provider {
	if (model.startsWith("claude-")) return "anthropic";
	if (model.startsWith("gemini-")) return "gemini";
	return "openai";
}

function estimateCost(model: TextModelId, usage: Usage) {
	const price = PRICE_PER_MILLION_TOKENS[model];
	return (
		(usage.inputTokens * price.input + usage.outputTokens * price.output) /
		1_000_000
	);
}

function addUsage(left: Usage, right: Usage): Usage {
	return {
		inputTokens: left.inputTokens + right.inputTokens,
		outputTokens: left.outputTokens + right.outputTokens,
		totalTokens: left.totalTokens + right.totalTokens,
	};
}

function normalizeCompletionText(text: string, finishReason: string | null) {
	const normalized = normalizeStoryText(text).trim();
	return finishReason === "length" || finishReason === "max_tokens"
		? trimToSentenceBoundary(normalized)
		: normalized;
}

function trimToSentenceBoundary(text: string): string {
	const match = text.match(/^[\s\S]*[.!?]["')\]]*/);
	return match ? match[0].trimEnd() : text;
}

function toAnthropicMessages(messages: ChatMessage[]): {
	systemContent: string;
	conversationMessages: AnthropicMessage[];
} {
	return {
		systemContent: messages
			.filter((message) => message.role === "system")
			.map((message) => message.content)
			.join("\n\n"),
		conversationMessages: messages
			.filter((message) => message.role !== "system")
			.map((message) => ({
				role: message.role as "user" | "assistant",
				content: message.content,
			})),
	};
}

function toGeminiMessages(messages: ChatMessage[]): {
	systemContent: string;
	conversationMessages: GeminiContent[];
} {
	const systemContent = messages
		.filter((message) => message.role === "system")
		.map((message) => message.content)
		.join("\n\n");
	const conversationMessages = messages
		.filter((message) => message.role !== "system")
		.map<GeminiContent>((message) => ({
			role: message.role === "assistant" ? "model" : "user",
			parts: [{ text: message.content }],
		}));
	return {
		systemContent,
		conversationMessages:
			conversationMessages.length > 0
				? conversationMessages
				: [{ role: "user", parts: [{ text: systemContent }] }],
	};
}

function splitSentences(text: string) {
	return text
		.split(/[.!?]+/)
		.map((sentence) => sentence.trim())
		.filter(Boolean);
}

function normalizeForComparison(text: string) {
	return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function similarity(a: string, b: string) {
	const aWords = new Set(a.split(/\s+/).filter(Boolean));
	const bWords = new Set(b.split(/\s+/).filter(Boolean));
	const intersection = [...aWords].filter((word) => bWords.has(word)).length;
	const union = new Set([...aWords, ...bWords]).size;
	return union === 0 ? 0 : intersection / union;
}

function clampScore(value: unknown) {
	const number = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(number)) return 1;
	return Math.min(5, Math.max(1, number));
}

function extractJsonObject(raw: string) {
	const trimmed = raw.trim();
	if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
	if (fenced?.[1]) return fenced[1].trim();
	const start = trimmed.indexOf("{");
	const end = trimmed.lastIndexOf("}");
	if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
	return trimmed;
}

async function appendJsonl(path: string, value: unknown) {
	await appendFile(path, `${JSON.stringify(value)}\n`);
}

function average(values: number[]) {
	if (values.length === 0) return 0;
	return sum(values) / values.length;
}

function median(values: number[]) {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
		: sorted[middle];
}

function sum(values: number[]) {
	return values.reduce((total, value) => total + value, 0);
}

function formatCurrency(value: number) {
	return `$${value.toFixed(value < 0.01 ? 6 : 4)}`;
}
