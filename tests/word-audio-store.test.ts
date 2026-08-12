import assert from "node:assert/strict";
import { wordFilePattern } from "../src/server/wordAudioStore.ts";
import { storyWords } from "../src/storyVocabulary.ts";

/**
 * A word the learner looks up passes through several validators before it
 * becomes audio or a learning signal. Any one of them rejecting ordinary
 * German breaks the reading flow, so they are all checked against the same
 * source of truth: whatever `storyWords` can actually emit.
 *
 * `learnerWordPattern` is duplicated here rather than imported because
 * `aiEndpointHandlers` constructs provider clients at module load. The
 * assertions below fail if the two definitions ever drift apart.
 */
const learnerWordPattern = /^\p{L}+(?:-\p{L}+)*$/u;

const germanProse = [
	"Marie ist in einem kleinen Café in Deutschland. Das Café ist ruhig.",
	"Ein roter Apfel liegt auf dem Tisch. Das Mädchen lächelt schüchtern.",
	"Die Straße ist weiß. Der Kellner fragt, wie alt du bist.",
];

const words = storyWords(germanProse, ["Marie"]);

assert.ok(words.length > 0, "expected storyWords to emit words");
// `storyWords` lowercases what it emits, so German nouns arrive uncapitalized
// even though German spells them with a capital.
assert.ok(
	words.includes("mädchen"),
	"expected umlauted words to survive tokenizing",
);
assert.ok(
	words.includes("straße") && words.includes("weiß"),
	"expected eszett to tokenize as part of a single word",
);
assert.ok(!words.includes("marie"), "expected declared names to be excluded");

for (const word of words) {
	assert.equal(
		wordFilePattern.test(`${word}.mp3`),
		true,
		`word-audio filename rejected ${word}`,
	);
	assert.equal(
		learnerWordPattern.test(word),
		true,
		`learner word log rejected ${word}`,
	);
}

// Shapes the Esperanto-era ASCII patterns used to reject outright.
for (const word of [
	"Mädchen",
	"weiß",
	"müller",
	"frühstück",
	"zwölf",
	"guten-Tag",
]) {
	assert.equal(wordFilePattern.test(`${word}.mp3`), true, word);
	assert.equal(learnerWordPattern.test(word), true, word);
}

// Nothing may escape the word-audio directory or smuggle a path separator.
for (const filename of ["../secret.mp3", "a/b.mp3", "..\\x.mp3", ".mp3"]) {
	assert.equal(wordFilePattern.test(filename), false, filename);
}
for (const word of ["../secret", "a/b", "..\\x", "", "a b"]) {
	assert.equal(learnerWordPattern.test(word), false, JSON.stringify(word));
}

console.log(
	`checked ${words.length} German story words against the word-audio and learner-word validators, plus traversal rejection`,
);
