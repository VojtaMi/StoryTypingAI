import assert from "node:assert/strict";
import { genres, getGenre } from "../src/genres.ts";
import {
	DEFAULT_STORY_MEMORY,
	mergeStoryMemory,
	type RecentStoryMemory,
} from "../src/learnerState.ts";
import { STARTER_NEXT_STORY_BRIEF } from "../src/nextStoryBrief.ts";
import { readingManuscriptMessages } from "../src/reading_story/manuscript.ts";
import {
	bundledSavePath,
	createBundleId,
} from "../src/server/storyBundleStore.ts";
import { buildStoryRecapPrompt } from "../src/storyRecap.ts";
import { isStoryName, storyWords } from "../src/storyVocabulary.ts";

assert.deepEqual(
	genres.map((language) => language.id),
	["esperanto", "german", "spanish"],
);
assert.equal(new Set(genres.map((language) => language.heroImageUrl)).size, 3);
assert.equal(new Set(genres.map((language) => language.botImageUrl)).size, 3);

const germanStoryId = createBundleId(
	"german",
	"Der kleine Schlüssel",
	"ABCDEF12-0000",
);
assert.equal(germanStoryId, "german--der-kleine-schlussel--abcdef12");
assert.match(
	bundledSavePath(germanStoryId),
	/\/stories\/german\/german--der-kleine-schlussel--abcdef12\/story\.json$/,
);

const german = getGenre("german");
const germanPrompt = readingManuscriptMessages(
	german,
	"A person finds a key and returns it.",
	german.starterBrief,
)[0].content;
assert.match(germanPrompt, /beginner German reading story/);
assert.match(germanPrompt, /capitalize every noun/i);
assert.match(germanPrompt, /verb-second/i);

const spanish = getGenre("spanish");
const spanishRecap = buildStoryRecapPrompt("present-tense actions", spanish);
assert.match(spanishRecap, /Spanish recap lesson/);
assert.match(spanishRecap, /piensa en/);

assert.equal(isStoryName("Petron", ["Petro"], "esperanto"), true);
assert.equal(isStoryName("Petron", ["Petro"], "german"), false);
assert.deepEqual(storyWords(["Petro vidas Petron."], ["Petro"], "esperanto"), [
	"vidas",
]);
assert.deepEqual(storyWords(["Petro sieht Petron."], ["Petro"], "german"), [
	"sieht",
	"petron",
]);

function memory(
	genreId: RecentStoryMemory["genreId"],
	index: number,
): RecentStoryMemory {
	return {
		genreId,
		motif: `${genreId} motif ${index}`,
		protagonist: "learner",
		setting: "room",
		elements: [`object ${index}`],
	};
}

let storyMemory = structuredClone(DEFAULT_STORY_MEMORY);
for (let index = 0; index < 6; index += 1) {
	storyMemory = mergeStoryMemory(
		storyMemory,
		memory("esperanto", index),
		"2026-08-20",
	);
}
storyMemory = mergeStoryMemory(storyMemory, memory("german", 0), "2026-08-20");
assert.equal(
	storyMemory.recentStories.filter((story) => story.genreId === "esperanto")
		.length,
	5,
);
assert.equal(
	storyMemory.recentStories.filter((story) => story.genreId === "german")
		.length,
	1,
);
assert.notDeepEqual(german.starterBrief, STARTER_NEXT_STORY_BRIEF);

console.log("language registry and isolation checks passed");
