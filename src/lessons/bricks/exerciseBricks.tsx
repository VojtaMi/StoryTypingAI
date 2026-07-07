import type { ReactNode } from "react";
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
	onComplete: () => void;
	onBack: () => void;
}

/**
 * An interactive brick owns how one exercise variant renders as a full step.
 * Same contract shape as the teaching bricks; adding an exercise type means
 * adding one spec here rather than another inline block in App.tsx.
 */
interface ExerciseBrickSpec<T extends LessonExercise> {
	render(exercise: T, ctx: ExerciseBrickCtx): ReactNode;
}

/** A word-match brick shows either its named subset of the lesson's words, or all of them. */
function wordsForWordMatch(lesson: Lesson, exercise: WordMatchLessonExercise) {
	if (!exercise.wordTerms) return lesson.introducedWords;
	const requested = new Set(exercise.wordTerms);
	return lesson.introducedWords.filter((word) => requested.has(word.term));
}

const wordMatchBrick: ExerciseBrickSpec<WordMatchLessonExercise> = {
	render: (exercise, ctx) => (
		<WordMatchExercise
			lessonId={ctx.lessonId}
			words={wordsForWordMatch(ctx.lesson, exercise)}
			lesson={ctx.lesson}
			title={exercise.title}
			hint={exercise.hint}
			completeLabel={exercise.completeLabel}
			onComplete={ctx.onComplete}
			onBack={ctx.onBack}
		/>
	),
};

const phraseBuilderBrick: ExerciseBrickSpec<PhraseBuilderLessonExercise> = {
	render: (exercise, ctx) => (
		<PhraseBuilderExercise
			lessonId={ctx.lessonId}
			title={exercise.title}
			hint={exercise.hint}
			prompts={exercise.prompts}
			lesson={ctx.lesson}
			completeLabel={exercise.completeLabel}
			onComplete={ctx.onComplete}
			onBack={ctx.onBack}
		/>
	),
};

const typingStoryBrick: ExerciseBrickSpec<TypingStoryLessonExercise> = {
	render: (exercise, ctx) => (
		<LessonTypingExercise
			lessonId={ctx.lessonId}
			text={ctx.lesson.story.join(" ")}
			imageUrl={exercise.imageUrl ?? DEFAULT_TYPING_IMAGE}
			lesson={ctx.lesson}
			onComplete={ctx.onComplete}
			onBack={ctx.onBack}
		/>
	),
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

export function renderExerciseBrick(
	exercise: LessonExercise,
	ctx: ExerciseBrickCtx,
): ReactNode {
	return (
		EXERCISE_BRICKS[exercise.type] as ExerciseBrickSpec<LessonExercise>
	).render(exercise, ctx);
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
