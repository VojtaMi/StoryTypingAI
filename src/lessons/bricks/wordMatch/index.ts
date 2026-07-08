import { createElement } from "react";
import { lessonVocab } from "../../lessonContent";
import type { Lesson, WordMatchLessonExercise } from "../../types";
import {
	type ExerciseBrickSpec,
	VOCABULARY_BODY_BRICK_TYPE,
} from "../contracts";
import WordMatchExercise from "./WordMatchExercise";

export function wordsForWordMatch(
	lesson: Lesson,
	exercise: WordMatchLessonExercise,
) {
	const vocab = lessonVocab(lesson);
	if (!exercise.wordTerms) return vocab;
	const requested = new Set(exercise.wordTerms);
	return vocab.filter((word) => requested.has(word.term));
}

export const wordMatchBrick: ExerciseBrickSpec<WordMatchLessonExercise> = {
	example: {
		id: "word-match",
		type: "word-match",
		title: "Connect the new words",
		hint: "Match each Esperanto word to its meaning.",
		completeLabel: "Continue to Story",
	},
	generation: {
		requires: VOCABULARY_BODY_BRICK_TYPE,
		create() {
			return {
				id: "word-match",
				type: "word-match",
				title: "Connect the new words",
				hint: "Match each Esperanto word to its meaning.",
				completeLabel: "Continue to Story",
			};
		},
	},
	render: (exercise, ctx) =>
		createElement(WordMatchExercise, {
			words: wordsForWordMatch(ctx.lesson, exercise),
			backgroundIntro: ctx.backgroundIntro,
			title: exercise.title,
			hint: exercise.hint,
			completeLabel: exercise.completeLabel,
			onComplete: ctx.onComplete,
			onBack: ctx.onBack,
		}),
	toBotContext: (exercise, lesson) => {
		const words = wordsForWordMatch(lesson, exercise);
		return [
			`## ${exercise.title ?? "Word matching"}`,
			exercise.hint,
			`Practice matching: ${words.map((word) => `${word.term} — ${word.meaning}`).join("; ")}`,
		]
			.filter(Boolean)
			.join("\n");
	},
};

export { default as WordMatchExercise } from "./WordMatchExercise";
