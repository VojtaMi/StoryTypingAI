import type { ReactNode } from "react";
import { lessonStoryText, lessonVocab } from "../lessonContent";
import LessonTypingExercise from "../templates/LessonTypingExercise";
import PhraseBuilderExercise from "../templates/PhraseBuilderExercise";
import WordMatchExercise from "../templates/WordMatchExercise";
import type {
	Lesson,
	LessonExercise,
	PhraseBuilderLessonExercise,
	TypingStoryLessonExercise,
	WordMatchLessonExercise,
} from "../types";
import {
	type LessonGeneratableBodyBrickType,
	STORY_BODY_BRICK_TYPE,
	VOCABULARY_BODY_BRICK_TYPE,
} from "./lessonBodyBricks";

const DEFAULT_TYPING_IMAGE = "/images/lesson-typing-bg.webp";

/**
 * What an interactive brick needs from its host to render as a lesson step:
 * the lesson it belongs to (for its vocabulary/story), and the curriculum's
 * "what happens next / go back" hooks. The brick derives everything else from
 * its own self-contained payload — it never reaches into sibling bricks.
 */
export interface ExerciseBrickCtx {
	lesson: Lesson;
	lessonId: string;
	backgroundIntro: string;
	onComplete: () => void;
	onBack: () => void;
}

/**
 * An interactive brick owns how one exercise variant renders as a full step.
 * Same contract shape as the teaching bricks; adding an exercise type means
 * adding one spec here rather than another inline block in App.tsx.
 */
/**
 * Generatable exercises are derived from the lesson's canonical body, never
 * authored by the model, so a brick only needs to say how to build itself.
 */
export interface ExerciseDerivationSpec {
	requires: LessonGeneratableBodyBrickType;
	create(): LessonExercise;
}

export interface ExerciseBrickSpec<T extends LessonExercise> {
	example: T;
	render(exercise: T, ctx: ExerciseBrickCtx): ReactNode;
	toBotContext(exercise: T, lesson: Lesson): string;
	generation?: ExerciseDerivationSpec;
}

/** A word-match brick shows either its named subset of the lesson's words, or all of them. */
export function wordsForWordMatch(
	lesson: Lesson,
	exercise: WordMatchLessonExercise,
) {
	const vocab = lessonVocab(lesson);
	if (!exercise.wordTerms) return vocab;
	const requested = new Set(exercise.wordTerms);
	return vocab.filter((word) => requested.has(word.term));
}

const wordMatchBrick: ExerciseBrickSpec<WordMatchLessonExercise> = {
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
	render: (exercise, ctx) => (
		<WordMatchExercise
			words={wordsForWordMatch(ctx.lesson, exercise)}
			backgroundIntro={ctx.backgroundIntro}
			title={exercise.title}
			hint={exercise.hint}
			completeLabel={exercise.completeLabel}
			onComplete={ctx.onComplete}
			onBack={ctx.onBack}
		/>
	),
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

const phraseBuilderBrick: ExerciseBrickSpec<PhraseBuilderLessonExercise> = {
	example: {
		id: "phrase-builder",
		type: "phrase-builder",
		title: "Build the sentence",
		hint: "Put the words in Esperanto order.",
		prompts: [
			{
				id: "kato-en-domo",
				meaning: "The cat is in the house.",
				answer: ["La", "kato", "estas", "en", "la", "domo"],
				distractors: ["granda", "varma"],
			},
		],
		completeLabel: "Continue",
	},
	render: (exercise, ctx) => (
		<PhraseBuilderExercise
			title={exercise.title}
			hint={exercise.hint}
			prompts={exercise.prompts}
			backgroundIntro={ctx.backgroundIntro}
			completeLabel={exercise.completeLabel}
			onComplete={ctx.onComplete}
			onBack={ctx.onBack}
		/>
	),
	toBotContext: (exercise) =>
		[
			`## ${exercise.title}`,
			exercise.hint,
			...exercise.prompts.map(
				(prompt) => `${prompt.meaning} → ${prompt.answer.join(" ")}`,
			),
		].join("\n"),
};

const typingStoryBrick: ExerciseBrickSpec<TypingStoryLessonExercise> = {
	example: {
		id: "typing",
		type: "typing-story",
	},
	generation: {
		requires: STORY_BODY_BRICK_TYPE,
		create() {
			return {
				id: "typing",
				type: "typing-story",
			};
		},
	},
	render: (exercise, ctx) => (
		<LessonTypingExercise
			lessonId={ctx.lessonId}
			text={lessonStoryText(ctx.lesson)}
			imageUrl={exercise.imageUrl ?? DEFAULT_TYPING_IMAGE}
			backgroundIntro={ctx.backgroundIntro}
			onComplete={ctx.onComplete}
			onBack={ctx.onBack}
		/>
	),
	toBotContext: (_exercise, lesson) =>
		[`## Story typing`, lessonStoryText(lesson)].join("\n"),
};

type ExerciseBrickRegistry = {
	[K in LessonExercise["type"]]: ExerciseBrickSpec<
		Extract<LessonExercise, { type: K }>
	>;
};

const EXERCISE_BRICKS: ExerciseBrickRegistry = {
	"word-match": wordMatchBrick,
	"phrase-builder": phraseBuilderBrick,
	"typing-story": typingStoryBrick,
};

export function exerciseBrickEntries(): [
	LessonExercise["type"],
	ExerciseBrickSpec<LessonExercise>,
][] {
	return Object.entries(EXERCISE_BRICKS).map(([type, spec]) => [
		type as LessonExercise["type"],
		spec as ExerciseBrickSpec<LessonExercise>,
	]);
}

export function renderExerciseBrick(
	exercise: LessonExercise,
	ctx: ExerciseBrickCtx,
): ReactNode {
	return brickFor(exercise).render(exercise, ctx);
}

function brickFor(exercise: LessonExercise): ExerciseBrickSpec<LessonExercise> {
	return EXERCISE_BRICKS[exercise.type] as ExerciseBrickSpec<LessonExercise>;
}

export function describeExerciseBrick(
	exercise: LessonExercise,
	lesson: Lesson,
): string {
	return brickFor(exercise).toBotContext(exercise, lesson);
}

/** Finds a lesson's exercise of a given type, so a host can render it as a brick. */
export function exerciseOfType<T extends LessonExercise["type"]>(
	lesson: Lesson,
	type: T,
): Extract<LessonExercise, { type: T }> {
	const found = lesson.exercises.find((exercise) => exercise.type === type);
	if (!found) {
		throw new Error(`Lesson ${lesson.id} is missing a ${type} exercise.`);
	}
	return found as Extract<LessonExercise, { type: T }>;
}

export const LESSON_GENERATABLE_EXERCISE_BRICK_TYPES = [
	"word-match",
	"typing-story",
] as const;

export type LessonGeneratableExerciseBrickType =
	(typeof LESSON_GENERATABLE_EXERCISE_BRICK_TYPES)[number];

export function exerciseDerivationSpec(
	type: LessonGeneratableExerciseBrickType,
): ExerciseDerivationSpec {
	const generation = EXERCISE_BRICKS[type].generation;
	if (!generation) throw new Error(`${type} cannot generate lesson content.`);
	return generation;
}
