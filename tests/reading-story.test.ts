import assert from "node:assert/strict";
import type { Genre } from "../src/genres.ts";
import { READING_STORY_MAX_TOKENS, SYSTEM_AI_PRESET } from "../src/models.ts";
import type { NarrationVoiceId } from "../src/narrationVoice.ts";
import {
	type NextStoryBrief,
	parseNextStoryBrief,
	STARTER_NEXT_STORY_BRIEF,
} from "../src/nextStoryBrief.ts";
import { completeAi, completeStructuredAi } from "../src/server/aiService.ts";
import { AiTraceError } from "../src/server/aiTrace.ts";
import {
	type ChatMessage,
	generateReadingStory,
	parseReadingStory,
	READING_STORY_IMAGE_COUNT,
	READING_STORY_TOTAL_PARTS,
	type ReadingStory,
	readingImagePrompt,
	readingStoryMessages,
	readingStoryPromptMessages,
} from "../src/story.ts";
import {
	createReadingMedia,
	type ReadingMediaSection,
} from "../src/story_session/readingMedia.ts";
import type { StoryBackgroundImage } from "../src/storyBackground.ts";
import { normalizeStoryText } from "../src/storyText.ts";
import { storyWords } from "../src/storyVocabulary.ts";

/**
 * A reading story is generated once and then only read. These assert the two
 * properties that makes possible: a story is either complete when it is parsed
 * or it is rejected, and a section's media is fetched once no matter how many
 * paths ask for it.
 */

const genre: Genre = {
	id: "esperanto",
	label: "Esperanto",
	systemPrompt: "Write Esperanto stories.",
	seeds: [],
} as unknown as Genre;

function part(index: number) {
	return {
		text: `Esperanta teksto de parto ${index}. Ĝi estas kompleta.`,
	};
}

function storyJson(overrides: Record<string, unknown> = {}) {
	return JSON.stringify({
		title: "Kvieta Mateno",
		storySummary: "A commuter notices a changed timetable.",
		moments: Array.from(
			{ length: READING_STORY_TOTAL_PARTS },
			(_, index) => `Story moment ${index + 1}.`,
		),
		languageFocus: "Plural direct-object noun phrases",
		mainCharacter: "Rikardo, an adult commuter",
		mainCharacterVisual:
			"Man in his forties, short grey hair, brown coat, canvas bag",
		setting: "A tram stop in light rain",
		characterNames: ["Rikardo"],
		imagePrompts: [
			"Rikardo reads the changed timetable at the tram stop.",
			"Rikardo boards a crowded tram in the rain.",
			"Rikardo steps onto an unfamiliar platform.",
		],
		parts: Array.from({ length: READING_STORY_TOTAL_PARTS }, (_, i) =>
			part(i + 1),
		),
		...overrides,
	});
}

// --- Prompt composition ------------------------------------------------------

const preferences = {
	prefer: ["Adult-respectful practical stories."],
	avoid: ["Ambiguous character locations."],
};
const nextStoryBrief: NextStoryBrief = {
	themeSuggestion: "seaside",
	language: {
		focus: "Using pensi pri",
		progression: "reinforce",
		complexity: "simpler",
		calibrationSnippets: ["Ivo pensas pri hieraŭ."],
	},
};

const promptMessages = readingStoryPromptMessages(
	genre,
	preferences,
	"gremlins",
	nextStoryBrief,
);
assert.equal(
	promptMessages.length,
	2,
	"Story generation should use one authoring contract and one bounded handoff.",
);
assert.match(promptMessages[0].content, /languageFocus exactly/i);
assert.doesNotMatch(promptMessages[0].content, /languageProfile|storyMemory/);
assert.match(promptMessages[0].content, /exactly 6 moments/i);
assert.match(promptMessages[0].content, /exactly 3 imagePrompts/i);
assert.match(promptMessages[0].content, /depicts a single moment/i);
assert.match(promptMessages[0].content, /convenient solution late/i);
assert.match(promptMessages[0].content, /part N expands only moment N/i);
const promptContext = JSON.parse(
	promptMessages[1].content.split("\n\n").at(-1) ?? "",
);
assert.deepEqual(promptContext.language, nextStoryBrief.language);
assert.deepEqual(promptContext.preferences.prefer, [
	"Adult-respectful practical stories.",
]);
assert.equal(promptContext.storySubject, "gremlins");
assert.equal(
	promptMessages[1].content.includes("seaside"),
	false,
	"an explicit subject must remove the finalizer suggestion from model context",
);
assert.equal("languageProfile" in promptContext, false);
assert.equal("storyMemory" in promptContext, false);

const suggestedSubjectContext = JSON.parse(
	readingStoryPromptMessages(genre, preferences, undefined, nextStoryBrief)[1]
		.content.split("\n\n")
		.at(-1) ?? "",
);
assert.equal(suggestedSubjectContext.storySubject, "seaside");
console.log(
	"checked reading story: prompt receives one self-contained handoff",
);

assert.deepEqual(
	parseNextStoryBrief(STARTER_NEXT_STORY_BRIEF),
	STARTER_NEXT_STORY_BRIEF,
);
assert.equal(
	parseNextStoryBrief({ ...STARTER_NEXT_STORY_BRIEF, history: [] }),
	null,
	"the handoff rejects extra history fields",
);
assert.match(
	STARTER_NEXT_STORY_BRIEF.language.calibrationSnippets[0],
	/ĝardeno/,
);
console.log("checked reading story: fixed starter brief is strict and minimal");

// --- Parsing and validation ---------------------------------------------------

const parsed = parseReadingStory(storyJson());
assert.equal(parsed.parts.length, READING_STORY_TOTAL_PARTS);
assert.equal(parsed.moments.length, READING_STORY_TOTAL_PARTS);
assert.equal(parsed.title, "Kvieta Mateno");
assert.equal(parsed.parts[5].text, part(6).text);
console.log("checked reading story: six complete parts accepted");

assert.equal(parsed.imagePrompts.length, READING_STORY_IMAGE_COUNT);
assert.equal(readingImagePrompt(parsed, 1), parsed.imagePrompts[0]);
assert.equal(readingImagePrompt(parsed, 2), parsed.imagePrompts[0]);
assert.equal(readingImagePrompt(parsed, 3), parsed.imagePrompts[1]);
assert.equal(readingImagePrompt(parsed, 5), parsed.imagePrompts[2]);
console.log("checked reading story: each part pair maps to one image prompt");

assert.deepEqual(
	storyWords(
		["Rikardo vidas Rikardon. La stacidomo estas granda."],
		["Rikardo"],
	),
	["vidas", "la", "stacidomo", "estas", "granda"],
);
console.log("checked reading vocabulary: names and accusative names excluded");

assert.deepEqual(
	parseReadingStory(`Here is the story:\n\`\`\`json\n${storyJson()}\n\`\`\``),
	parsed,
	"a fenced JSON story should parse to the same story",
);
console.log("checked reading story: fenced JSON accepted");

assert.deepEqual(
	parseReadingStory(`${storyJson()}}`),
	parsed,
	"A complete balanced JSON object should be recovered from trailing junk.",
);
console.log("checked reading story: trailing delimiter repaired locally");

const rejected: Array<[string, string]> = [
	[
		"five parts",
		storyJson({
			parts: Array.from({ length: 5 }, (_, i) => part(i + 1)),
		}),
	],
	[
		"seven parts",
		storyJson({
			parts: Array.from({ length: 7 }, (_, i) => part(i + 1)),
		}),
	],
	[
		"five moments",
		storyJson({
			moments: Array.from(
				{ length: 5 },
				(_, index) => `Story moment ${index + 1}.`,
			),
		}),
	],
	[
		"an empty moment",
		storyJson({
			moments: [
				...Array.from(
					{ length: 5 },
					(_, index) => `Story moment ${index + 1}.`,
				),
				"   ",
			],
		}),
	],
	[
		"a part with empty text",
		storyJson({
			parts: [
				...Array.from({ length: 5 }, (_, i) => part(i + 1)),
				{ languageFocus: "focus 6", text: "   " },
			],
		}),
	],
	[
		"too few image prompts",
		storyJson({ imagePrompts: ["only one", "only two"] }),
	],
	["an empty image prompt", storyJson({ imagePrompts: ["one", "two", "   "] })],
	["no languageFocus", storyJson({ languageFocus: "" })],
	["no title", storyJson({ title: "" })],
	["no storySummary", storyJson({ storySummary: "" })],
	["no mainCharacterVisual", storyJson({ mainCharacterVisual: "" })],
	["no setting", storyJson({ setting: "  " })],
	["output truncated mid-JSON", storyJson().slice(0, storyJson().length - 40)],
	["prose instead of JSON", "Mi ne povas skribi rakonton."],
];

for (const [label, raw] of rejected) {
	assert.throws(
		() => parseReadingStory(raw),
		`A reading story with ${label} must be rejected, not saved as complete.`,
	);
	console.log(`checked reading story: rejected ${label}`);
}

const storyWithCurlyDialogue = storyJson({
	parts: [
		{ ...part(1), text: "Mara diras: “Jes, la ĉambro estas preta.”" },
		...Array.from({ length: READING_STORY_TOTAL_PARTS - 1 }, (_, index) =>
			part(index + 2),
		),
	],
});
process.env.OPENAI_API_KEY = "test-key";
let requestedReasoningEffort: string | undefined;
const fakeStructuredOpenAi = {
	chat: {
		completions: {
			create: async (request: { reasoning_effort?: string }) => {
				requestedReasoningEffort = request.reasoning_effort;
				return {
					choices: [
						{
							finish_reason: "stop",
							message: { content: storyWithCurlyDialogue },
						},
					],
				};
			},
		},
	},
} as never;
const rawStructuredStory = await completeStructuredAi(fakeStructuredOpenAi, []);
assert.equal(requestedReasoningEffort, "none");
assert.doesNotThrow(
	() => parseReadingStory(rawStructuredStory),
	"Structured completion must preserve valid JSON containing curly dialogue quotes.",
);
assert.equal(
	normalizeStoryText("Mara diras: “Jes.”"),
	'Mara diras: "Jes."',
	"User-facing prose normalization keeps typing punctuation keyboard-friendly.",
);
assert.equal(
	await completeAi(fakeStructuredOpenAi, []),
	rawStructuredStory,
	"Generic text completion must not apply typing-specific normalization.",
);
const emptyOpenAi = {
	chat: {
		completions: {
			create: async () => ({
				id: "completion-empty",
				choices: [
					{
						finish_reason: "length",
						message: { content: "", refusal: null },
					},
				],
				usage: {
					completion_tokens: 4000,
					prompt_tokens: 1000,
					total_tokens: 5000,
				},
			}),
		},
	},
} as never;
await assert.rejects(
	completeStructuredAi(emptyOpenAi, []),
	(error: unknown) => {
		assert(error instanceof AiTraceError);
		assert.deepEqual(error.details, {
			responseId: "completion-empty",
			finishReason: "length",
			refusal: null,
			usage: {
				completion_tokens: 4000,
				prompt_tokens: 1000,
				total_tokens: 5000,
			},
			choiceCount: 1,
		});
		return true;
	},
	"Empty completions should retain provider diagnostics for the failure trace.",
);
await completeStructuredAi(fakeStructuredOpenAi, [], 400, "gpt-5.6-luna", "", {
	reasoningEffort: "low",
});
assert.equal(
	requestedReasoningEffort,
	"low",
	"A completion-specific reasoning effort must override the latency default.",
);
console.log(
	"checked reading story: structured JSON bypasses prose normalization",
);

let storyReasoningEffort: string | undefined;
let storyMaxTokens: number | undefined;
await generateReadingStory(async (_messages, maxTokens, options) => {
	storyReasoningEffort = options?.reasoningEffort;
	storyMaxTokens = maxTokens;
	return storyJson();
}, genre);
assert.equal(
	storyMaxTokens,
	READING_STORY_MAX_TOKENS,
	"Whole-story generation should use the dedicated reading-story budget.",
);
assert.equal(
	storyReasoningEffort,
	"low",
	"Whole-story planning and execution should use low reasoning.",
);
console.log("checked reading story: generation requests low reasoning");

await generateReadingStory(
	async (_messages, _maxTokens, options) => {
		storyReasoningEffort = options?.reasoningEffort;
		return storyJson();
	},
	genre,
	undefined,
	undefined,
	{ reasoningEffort: "medium" },
);
assert.equal(
	storyReasoningEffort,
	"medium",
	"A selected story preset should override the initial generation effort.",
);
console.log("checked reading story: selected reasoning is forwarded");

// A truncated story must fail even after the repair pass fails to fix it, and
// the caller must see the failure rather than a partial story.
await assert.rejects(
	generateReadingStory(
		async () => storyJson({ parts: [part(1), part(2)] }),
		genre,
	),
	"An incomplete story that repair cannot fix must fail, not resolve.",
);
console.log("checked reading story: incomplete generation fails after repair");

// The repair pass is allowed to rescue malformed output.
let attempt = 0;
const repairOptions: Array<{
	model?: string;
	reasoningEffort?: string;
}> = [];
const repaired = await generateReadingStory(
	async (messages, _maxTokens, options) => {
		attempt += 1;
		repairOptions.push(options ?? {});
		if (attempt === 2) {
			assert.match(
				messages.at(-1)?.content ?? "",
				/Validation failure:/,
				"repair receives the concrete parse failure",
			);
		}
		return attempt === 1 ? "```\n{oops," : storyJson();
	},
	genre,
);
assert.equal(attempt, 2);
assert.deepEqual(repairOptions, [{ reasoningEffort: "low" }, SYSTEM_AI_PRESET]);
assert.equal(repaired.parts.length, READING_STORY_TOTAL_PARTS);
console.log("checked reading story: repair pass rescues malformed JSON");

let deterministicAttempts = 0;
await generateReadingStory(async () => {
	deterministicAttempts += 1;
	return `${storyJson()}}`;
}, genre);
assert.equal(
	deterministicAttempts,
	1,
	"Deterministically recoverable JSON must not trigger an AI repair call.",
);
console.log("checked reading story: local repair avoids an AI retry");

// --- Advancing costs no text generation --------------------------------------

const story: ReadingStory = parsed;
const messagesForPart2 = readingStoryMessages(genre, story, 2);
assert.deepEqual(
	messagesForPart2.filter((message) => message.role === "assistant"),
	[
		{ role: "assistant", content: story.parts[0].text },
		{ role: "assistant", content: story.parts[1].text },
	] satisfies ChatMessage[],
);
assert.equal(
	story.parts[2].text,
	part(3).text,
	"Advancing selects the next part of the story that already exists.",
);
console.log("checked reading story: advancing reads parts, generates no text");

// --- Media is requested once per section -------------------------------------

const voice = "alloy" as NarrationVoiceId;
function section(partIndex: number): ReadingMediaSection {
	return {
		storyId: "kvieta-mateno--1234abcd",
		partIndex,
		narrationVoice: voice,
		text: story.parts[partIndex - 1].text,
		imagePrompt: readingImagePrompt(story, partIndex),
		genre,
		visualContext: "Main character: Rikardo.",
	};
}

let imageCalls = 0;
let audioCalls = 0;
const media = createReadingMedia({
	generateAudio: async () => {
		audioCalls += 1;
		await Promise.resolve();
		return null;
	},
	generateBackground: async (): Promise<StoryBackgroundImage> => {
		imageCalls += 1;
		await Promise.resolve();
		return {
			backgroundImageUrl: "/api/story-images/x/section_3.webp",
			backgroundImageSource: "generated",
		};
	},
});

// Two paths asking for the same section concurrently — preparing it ahead and
// arriving at it — must share one provider call, not make two.
const [prepared, arrived] = await Promise.all([
	media.prepare(section(3)),
	media.requestBackground(section(3)),
]);
assert.equal(imageCalls, 1, "Identical concurrent image requests must dedupe.");
assert.equal(audioCalls, 1, "Identical concurrent audio requests must dedupe.");
assert.equal(
	prepared.backgroundImage?.backgroundImageUrl,
	arrived?.backgroundImageUrl,
);

await media.requestBackground(section(3));
assert.equal(
	imageCalls,
	1,
	"A section's image is not generated a second time.",
);

// Even sections get no image of their own: the cadence keeps the previous one.
assert.equal(await media.requestBackground(section(4)), null);
assert.equal(imageCalls, 1, "Even sections must not request an image.");

// Media already in hand is never generated.
media.seed(section(5), {
	backgroundImage: {
		backgroundImageUrl: "/api/story-images/x/section_5.webp",
		backgroundImageSource: "generated",
	},
});
const seeded = await media.requestBackground(section(5));
assert.equal(seeded?.backgroundImageUrl, "/api/story-images/x/section_5.webp");
assert.equal(imageCalls, 1, "Seeded media must not be generated again.");
console.log("checked reading media: one provider call per section");

console.log("\nreading story checks passed");
