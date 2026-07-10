import { createElement } from "react";
import { lessonVocab } from "../../lessonContent";
import type { Lesson, ShortTypingLessonExercise } from "../../types";
import {
	type ExerciseBrickSpec,
	VOCABULARY_BODY_BRICK_TYPE,
} from "../contracts";
import { clozeFor } from "../vocabulary";
import ShortTypingExercise from "./ShortTypingExercise";

export interface ShortTypingPrompt {
	id: string;
	target: string;
	cue: string;
}

export function promptsForShortTyping(
	lesson: Lesson,
	exercise: ShortTypingLessonExercise,
): ShortTypingPrompt[] {
	const vocab = lessonVocab(lesson);
	const requested = exercise.wordTerms
		? new Set(exercise.wordTerms)
		: undefined;
	const words = requested
		? vocab.filter((word) => requested.has(word.term))
		: vocab;

	return words.map((word) => {
		clozeFor(word);
		return {
			id: word.term,
			target: word.example,
			cue: word.meaning,
		};
	});
}

export const shortTypingBrick: ExerciseBrickSpec<ShortTypingLessonExercise> = {
	weight: "light",
	example: {
		id: "short-typing",
		type: "short-typing",
		title: "Type the examples",
		hint: "Type each vocabulary sentence.",
		completeLabel: "Continue →",
	},
	generation: {
		requires: VOCABULARY_BODY_BRICK_TYPE,
		create() {
			return {
				id: "short-typing",
				type: "short-typing",
				title: "Type the examples",
				hint: "Type each vocabulary sentence.",
				completeLabel: "Continue →",
			};
		},
	},
	assertRenderable(exercise, lesson) {
		const prompts = promptsForShortTyping(lesson, exercise);
		if (prompts.length < 1) {
			throw new Error(
				`Lesson ${lesson.id} short-typing needs at least one prompt.`,
			);
		}
	},
	render: (exercise, ctx) =>
		createElement(ShortTypingExercise, {
			title: exercise.title ?? "Type the examples",
			hint: exercise.hint ?? "Type each vocabulary sentence.",
			prompts: promptsForShortTyping(ctx.lesson, exercise),
			backgroundIntro: ctx.backgroundIntro,
			completeLabel: exercise.completeLabel,
			onComplete: ctx.onComplete,
			onBack: ctx.onBack,
		}),
	toBotContext: (exercise, lesson) =>
		[
			`## ${exercise.title ?? "Type the examples"}`,
			exercise.hint,
			...promptsForShortTyping(lesson, exercise).map(
				(prompt) => `${prompt.cue} → ${prompt.target}`,
			),
		]
			.filter(Boolean)
			.join("\n"),
};

export { default as ShortTypingExercise } from "./ShortTypingExercise";
