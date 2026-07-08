import type { ReactNode } from "react";
import type { GenerationSpec } from "../../structuredGeneration";
import type { Lesson, LessonExercise } from "../types";

export interface LessonBodyRenderCtx {
	ready: Set<string>;
	playing: string | null;
	onPlay: (id: string, text: string) => void;
}

export interface LessonBodyBrickSpec<T> {
	example: T;
	render(block: T, ctx: LessonBodyRenderCtx): ReactNode;
	toBotContext(block: T): string;
	generation?: GenerationSpec<T>;
}

export const LESSON_GENERATABLE_BODY_BRICK_TYPES = [
	"vocabulary",
	"grammar",
	"overview",
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
	example: T;
	render(exercise: T, ctx: ExerciseBrickCtx): ReactNode;
	toBotContext(exercise: T, lesson: Lesson): string;
	generation?: ExerciseDerivationSpec;
}
