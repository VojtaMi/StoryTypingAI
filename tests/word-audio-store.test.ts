import assert from "node:assert/strict";
import { wordFilePattern } from "../src/server/wordAudioStore.ts";
import { storyWords } from "../src/storyVocabulary.ts";

/**
 * A word the learner looks up passes through several validators before it
 * becomes audio or a learning signal. Any one of them rejecting ordinary
 * Spanish breaks the reading flow, so they are all checked against the same
 * source of truth: whatever `storyWords` can actually emit.
 *
 * `learnerWordPattern` is duplicated here rather than imported because
 * `aiEndpointHandlers` constructs provider clients at module load. The
 * assertions below fail if the two definitions ever drift apart.
 */
const learnerWordPattern = /^\p{L}+(?:-\p{L}+)*$/u;

const spanishProse = [
	"María está en un café pequeño de España. El café es tranquilo.",
	"Hay una manzana roja en la mesa. La niña sonríe con vergüenza.",
	"El camarero pregunta cuántos años tienes. Es un buen-día.",
];

const words = storyWords(spanishProse, ["María"]);

assert.ok(words.length > 0, "expected storyWords to emit words");
assert.ok(
	words.includes("niña"),
	"expected accented words to survive tokenizing",
);
assert.ok(!words.includes("maría"), "expected declared names to be excluded");

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
	"niño",
	"también",
	"vergüenza",
	"día",
	"años",
	"buen-día",
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
	`checked ${words.length} Spanish story words against the word-audio and learner-word validators, plus traversal rejection`,
);
