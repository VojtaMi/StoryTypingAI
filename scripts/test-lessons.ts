import assert from "node:assert/strict";
import {
	assertLessonExercises,
	clozeFor,
	patternShape,
} from "../src/lessons/bricks/index.ts";
import { lessons } from "../src/lessons/predefined/lessons.ts";
import type { Lesson } from "../src/lessons/types.ts";

/**
 * `test-bricks.ts` asserts that bricks are well-formed. This asserts the other
 * half: that our lesson corpus satisfies the preconditions those bricks render
 * against. Both run in `npm run check`, because a brick with an unmeetable
 * precondition and a lesson that fails to meet one are different bugs.
 */
for (const lesson of lessons) {
	checkVocabulary(lesson);
	checkPatterns(lesson);
	checkTypingScene(lesson);
	checkExerciseIds(lesson);

	// Every exercise must be renderable from this lesson's own content.
	assertLessonExercises(lesson);

	console.log(`checked lesson:${lesson.id}`);
}

function checkVocabulary(lesson: Lesson) {
	for (const word of lesson.introducedWords) {
		// Throws unless the example contains the term plus at least one other word.
		// The vocabulary card renders this, and fill-blank blanks the term out of it.
		clozeFor(word);
	}

	const meanings = new Set(lesson.introducedWords.map((word) => word.meaning));
	assert.equal(
		meanings.size,
		lesson.introducedWords.length,
		`Lesson ${lesson.id} reuses an English meaning, so a matching grid or a fill-blank gloss would be ambiguous.`,
	);
}

function checkPatterns(lesson: Lesson) {
	for (const pattern of lesson.patterns ?? []) {
		if (!pattern.title) continue;
		assert.notEqual(
			pattern.title.toLowerCase(),
			patternShape(pattern).toLowerCase(),
			`Lesson ${lesson.id} pattern "${pattern.id}" titles itself with its own slots. Drop the title; the slot chips already say it.`,
		);
	}
}

function checkTypingScene(lesson: Lesson) {
	const typing = lesson.exercises.find(
		(exercise) => exercise.type === "typing-story",
	);
	if (typing?.type !== "typing-story" || !typing.imageUrl) return;
	assert.ok(
		lesson.storyImagePrompt,
		`Lesson ${lesson.id} paints a custom typing scene but never describes it, so it has no accessible name.`,
	);
}

function checkExerciseIds(lesson: Lesson) {
	const ids = new Set(lesson.exercises.map((exercise) => exercise.id));
	assert.equal(
		ids.size,
		lesson.exercises.length,
		`Lesson ${lesson.id} reuses an exercise id.`,
	);
}
