import assert from "node:assert/strict";
import type { Genre } from "../src/genres.ts";
import type { NarrationVoiceId } from "../src/narrationVoice.ts";
import { completeAi, completeStructuredAi } from "../src/server/aiService.ts";
import {
	type ChatMessage,
	generateReadingStory,
	parseReadingStory,
	READING_STORY_TOTAL_PARTS,
	type ReadingStory,
	readingStoryMessages,
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
		languageFocus: `focus ${index}`,
		text: `Esperanta teksto de parto ${index}. Ĝi estas kompleta.`,
	};
}

function storyJson(overrides: Record<string, unknown> = {}) {
	return JSON.stringify({
		title: "Kvieta Mateno",
		storySummary: "A commuter notices a changed timetable.",
		mainCharacter: "Rikardo, an adult commuter",
		mainCharacterVisual:
			"Man in his forties, short grey hair, brown coat, canvas bag",
		setting: "A tram stop in light rain",
		characterNames: ["Rikardo"],
		parts: Array.from({ length: READING_STORY_TOTAL_PARTS }, (_, i) =>
			part(i + 1),
		),
		...overrides,
	});
}

// --- Parsing and validation ---------------------------------------------------

const parsed = parseReadingStory(storyJson());
assert.equal(parsed.parts.length, READING_STORY_TOTAL_PARTS);
assert.equal(parsed.title, "Kvieta Mateno");
assert.equal(parsed.parts[5].text, part(6).text);
console.log("checked reading story: six complete parts accepted");

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
		"a part with empty text",
		storyJson({
			parts: [
				...Array.from({ length: 5 }, (_, i) => part(i + 1)),
				{ languageFocus: "focus 6", text: "   " },
			],
		}),
	],
	[
		"a part with no languageFocus",
		storyJson({
			parts: [
				...Array.from({ length: 5 }, (_, i) => part(i + 1)),
				{ role: "ending", text: part(6).text },
			],
		}),
	],
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
const fakeStructuredOpenAi = {
	chat: {
		completions: {
			create: async () => ({
				choices: [
					{
						finish_reason: "stop",
						message: { content: storyWithCurlyDialogue },
					},
				],
			}),
		},
	},
} as never;
const rawStructuredStory = await completeStructuredAi(fakeStructuredOpenAi, []);
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
console.log(
	"checked reading story: structured JSON bypasses prose normalization",
);

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
