import type { ReactNode } from "react";
import type { GenerationSpec } from "../../structuredGeneration";
import type { Lesson, LessonExercise } from "../types";

export interface LessonBodyRenderCtx {
	ready: Set<string>;
	playing: string | null;
	onPlay: (id: string, text: string) => void;
}

export type LessonBrickWeight = "light" | "heavy";

export interface LessonBodyBrickSpec<T> {
	weight: LessonBrickWeight;
	example: T;
	render(block: T, ctx: LessonBodyRenderCtx): ReactNode;
	toBotContext(block: T): string;
	generation?: GenerationSpec<T>;
}

export const LESSON_GENERATABLE_BODY_BRICK_TYPES = [
	"vocabulary",
	"grammar",
	"overview",
	"tip",
	"story",
] as const;

export type LessonGeneratableBodyBrickType =
	(typeof LESSON_GENERATABLE_BODY_BRICK_TYPES)[number];

export const VOCABULARY_BODY_BRICK_TYPE = "vocabulary";
export const STORY_BODY_BRICK_TYPE = "story";

export interface ExerciseBrickCtx {
	lesson: Lesson;
	lessonId: string;
	backgroundIntro: string;
	onComplete: () => void;
	onBack: () => void;
}

export interface ExerciseDerivationSpec {
	requires: LessonGeneratableBodyBrickType;
	create(): LessonExercise;
}

export interface ExerciseBrickSpec<T extends LessonExercise> {
	weight: LessonBrickWeight;
	example: T;
	render(exercise: T, ctx: ExerciseBrickCtx): ReactNode;
	toBotContext(exercise: T, lesson: Lesson): string;
	generation?: ExerciseDerivationSpec;
	/**
	 * Throws if this lesson cannot supply what the exercise renders. An exercise
	 * that derives its content from the lesson (every one but `phrase-builder`)
	 * can be listed by a lesson that lacks that content — a `wordTerms` typo, an
	 * empty story — and would then render an empty screen.
	 *
	 * Called once where a lesson is born: `parseGeneratedLesson()` for the model
	 * path, `tests/lessons.test.ts` for the hand-written corpus. Never at
	 * render; by then the empty screen is already up.
	 */
	assertRenderable?(exercise: T, lesson: Lesson): void;
}
