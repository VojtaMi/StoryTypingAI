import { createElement } from "react";
import { lessonVocab } from "../../lessonContent";
import type { FillBlankLessonExercise, Lesson } from "../../types";
import {
	type ExerciseBrickSpec,
	VOCABULARY_BODY_BRICK_TYPE,
} from "../contracts";
import { clozeFor } from "../vocabulary";
import FillBlankExercise from "./FillBlankExercise";

/** How many wrong terms sit beside the answer. */
const DISTRACTOR_COUNT = 3;

export interface FillBlankPrompt {
	id: string;
	/** The example sentence, carved around the term. */
	before: string;
	after: string;
	/** The term, lowercase — it doubles as a word-audio cache key. */
	answer: string;
	/**
	 * The English meaning. Not decoration: `Mi estas ___.` accepts both `homo`
	 * and `kato` until the gloss says which one is wanted, and `li` and `ŝi`
	 * share the blank context `___ estas homo.` entirely.
	 */
	meaning: string;
	choices: string[];
}

/**
 * Derives the prompts from the lesson's own vocabulary. Nothing is stored on the
 * exercise, so a blank can never disagree with the word it tests: the sentence
 * is `word.example`, the answer is `word.term`, and `clozeFor` proves the one
 * contains the other. Mirrors `wordsForWordMatch`.
 */
export function promptsForFillBlank(
	lesson: Lesson,
	exercise: FillBlankLessonExercise,
): FillBlankPrompt[] {
	const vocab = lessonVocab(lesson);
	const requested = exercise.wordTerms
		? new Set(exercise.wordTerms)
		: undefined;
	const words = requested
		? vocab.filter((word) => requested.has(word.term))
		: vocab;

	return words.map((word) => {
		const { before, after } = clozeFor(word);
		const others = words.filter((other) => other.term !== word.term);
		// A distractor only teaches something if it could plausibly fill the blank,
		// so words of the same part of speech come first. Otherwise `li` and `ŝi`
		// — the pair this lesson exists to separate — would never appear together.
		const distractors = [
			...others.filter((other) => other.partOfSpeech === word.partOfSpeech),
			...others.filter((other) => other.partOfSpeech !== word.partOfSpeech),
		]
			.slice(0, DISTRACTOR_COUNT)
			.map((other) => other.term);
		return {
			id: word.term,
			before,
			after,
			answer: word.term,
			meaning: word.meaning,
			choices: [word.term, ...distractors],
		};
	});
}

export const fillBlankBrick: ExerciseBrickSpec<FillBlankLessonExercise> = {
	example: {
		id: "fill-blank",
		type: "fill-blank",
		title: "Complete the sentence",
		hint: "Choose the word the sentence is missing.",
		completeLabel: "Continue →",
	},
	generation: {
		requires: VOCABULARY_BODY_BRICK_TYPE,
		create() {
			return {
				id: "fill-blank",
				type: "fill-blank",
				title: "Complete the sentence",
				hint: "Choose the word the sentence is missing.",
				completeLabel: "Continue →",
			};
		},
	},
	assertRenderable(exercise, lesson) {
		const prompts = promptsForFillBlank(lesson, exercise);
		if (prompts.length < 2) {
			throw new Error(
				`Lesson ${lesson.id} fill-blank needs at least two prompts, got ${prompts.length}.`,
			);
		}
		for (const prompt of prompts) {
			if (prompt.choices.length < 2) {
				throw new Error(
					`Lesson ${lesson.id} fill-blank prompt "${prompt.id}" has nothing to choose between.`,
				);
			}
			if (!prompt.choices.includes(prompt.answer)) {
				throw new Error(
					`Lesson ${lesson.id} fill-blank prompt "${prompt.id}" omits its own answer.`,
				);
			}
		}
		const meanings = new Set(prompts.map((prompt) => prompt.meaning));
		if (meanings.size !== prompts.length) {
			throw new Error(
				`Lesson ${lesson.id} fill-blank reuses an English meaning, so two prompts ask for the same thing.`,
			);
		}
	},
	render: (exercise, ctx) =>
		createElement(FillBlankExercise, {
			title: exercise.title ?? "Complete the sentence",
			hint: exercise.hint ?? "Choose the word the sentence is missing.",
			prompts: promptsForFillBlank(ctx.lesson, exercise),
			backgroundIntro: ctx.backgroundIntro,
			completeLabel: exercise.completeLabel,
			onComplete: ctx.onComplete,
			onBack: ctx.onBack,
		}),
	toBotContext: (exercise, lesson) =>
		[
			`## ${exercise.title ?? "Complete the sentence"}`,
			exercise.hint,
			...promptsForFillBlank(lesson, exercise).map(
				(prompt) =>
					`${prompt.before}___${prompt.after} (${prompt.meaning}) → ${prompt.answer}`,
			),
		]
			.filter(Boolean)
			.join("\n"),
};

export { default as FillBlankExercise } from "./FillBlankExercise";
