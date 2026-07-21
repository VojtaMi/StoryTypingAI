import assert from "node:assert/strict";
import type { Genre } from "../src/genres.ts";
import type { LearnerContext } from "../src/learnerState.ts";
import type { NarrationVoiceId } from "../src/narrationVoice.ts";
import { completeAi, completeStructuredAi } from "../src/server/aiService.ts";
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

const learnerContext: LearnerContext = {
	languageProfile: {
		version: 1,
		updated: "2026-07-20",
		confident: ["Simple present-tense sentences."],
		learning: ["Plural direct-object noun phrases."],
		shaky: ["Accusative endings need reinforcement."],
		recentlyPracticed: ["Concrete location phrases."],
		notes: ["The previous story felt difficult."],
	},
	preferences: {
		version: 1,
		updated: "2026-07-20",
		prefer: ["Adult-respectful practical stories."],
		avoid: ["Ambiguous character locations."],
		clarityGuidance: ["Make clue relationships explicit."],
	},
	storyMemory: {
		version: 1,
		updated: "2026-07-20",
		recentStories: [
			{
				motif: "finding a lost parcel",
				protagonist: "a station clerk",
				setting: "a railway station",
				elements: ["parcel", "platform"],
			},
		],
	},
};

const promptMessages = readingStoryPromptMessages(genre, learnerContext);
assert.equal(
	promptMessages.length,
	3,
	"Story generation should use one authoring prompt, one context envelope, and one request.",
);
assert.match(promptMessages[0].content, /exactly one primary language target/);
assert.match(
	promptMessages[0].content,
	/Read the overall difficulty baseline from languageProfile/,
);
assert.doesNotMatch(
	promptMessages[0].content,
	/languageProfile\.level/,
	"the dropped level field must not reappear in the authoring prompt",
);
assert.match(
	promptMessages[0].content,
	/not an exhaustive list of known words/,
);
assert.match(
	promptMessages[0].content,
	/return that target as the single story-level languageFocus/i,
);
assert.match(promptMessages[0].content, /exactly 6 moments/i);
assert.match(promptMessages[0].content, /exactly 3 imagePrompts/i);
assert.match(promptMessages[0].content, /depicts a single moment/i);
assert.match(promptMessages[0].content, /apply the removal test/i);
assert.match(promptMessages[0].content, /part N expands only moment N/i);
const promptContext = JSON.parse(
	promptMessages[1].content.split("\n\n").at(-1) ?? "",
);
assert.deepEqual(promptContext.languageProfile.learning, [
	"Plural direct-object noun phrases.",
]);
assert.deepEqual(promptContext.preferences.prefer, [
	"Adult-respectful practical stories.",
]);
assert.deepEqual(promptContext.storyMemory.recentStories, [
	learnerContext.storyMemory.recentStories[0],
]);
assert.equal(
	promptMessages[1].content.includes('"updated"'),
	false,
	"Persistence metadata should not consume generation context.",
);
assert.equal(
	promptMessages
		.map((message) => message.content)
		.join("\n")
		.match(/Untrusted learner data/g)?.length,
	1,
);
console.log("checked reading story: compact prompt has one context boundary");

// --- Reading-chain hard override ---------------------------------------------

const reinforceMessages = readingStoryPromptMessages(
	genre,
	learnerContext,
	undefined,
	{
		nextFocus: { focus: "Using pensi pri", mode: "reinforce" },
		nextPace: "simpler",
	},
);
const reinforceContent = reinforceMessages.at(-1)?.content ?? "";
assert.match(
	reinforceContent,
	/Set this story's single primary languageFocus to exactly this concept: "Using pensi pri"/,
	"a chain hint hard-overrides the story's languageFocus",
);
assert.match(
	reinforceContent,
	/required override of the rule that chooses the focus from languageProfile\.learning/,
	"the override is stated as required, not a soft nudge",
);
assert.match(
	reinforceContent,
	/different construction/i,
	"reinforce mode demands a varied construction",
);
assert.match(reinforceContent, /a step simpler/i, "simpler pace nudges down");

const advanceMessages = readingStoryPromptMessages(
	genre,
	learnerContext,
	undefined,
	{
		nextFocus: { focus: "Accusative on plural nouns", mode: "advance" },
		nextPace: "harder",
	},
);
const advanceContent = advanceMessages.at(-1)?.content ?? "";
assert.match(
	advanceContent,
	/next step beyond the concept/i,
	"advance moves on",
);
assert.match(
	advanceContent,
	/a step more challenging/i,
	"harder pace nudges up",
);

assert.equal(
	readingStoryPromptMessages(genre, learnerContext).length,
	3,
	"no chain hint leaves the prompt at its three baseline messages",
);
console.log("checked reading story: chain hint hard-overrides focus and pace");

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
await generateReadingStory(async (_messages, _maxTokens, options) => {
	storyReasoningEffort = options?.reasoningEffort;
	return storyJson();
}, genre);
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
const repaired = await generateReadingStory(async (messages) => {
	attempt += 1;
	if (attempt === 2) {
		assert.match(
			messages.at(-1)?.content ?? "",
			/Validation failure:/,
			"repair receives the concrete parse failure",
		);
	}
	return attempt === 1 ? "```\n{oops," : storyJson();
}, genre);
assert.equal(attempt, 2);
assert.equal(repaired.parts.length, READING_STORY_TOTAL_PARTS);
console.log("checked reading story: repair pass rescues malformed JSON");

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
