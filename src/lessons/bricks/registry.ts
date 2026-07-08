import type { GenerationSpec } from "../../structuredGeneration";
import { lessonStoryText, lessonVocab } from "../lessonContent";
import type { Lesson, LessonExercise, LessonTeachingSection } from "../types";
import type {
	ExerciseBrickSpec,
	ExerciseDerivationSpec,
	LessonBodyBrickSpec,
	LessonBodyRenderCtx,
	LessonGeneratableBodyBrickType,
} from "./contracts";
import { grammarBrick, type LessonGrammarBlock } from "./grammar";
import { type LessonPatternsBlock, patternsBrick } from "./patterns";
import { phraseBuilderBrick } from "./phraseBuilder";
import { type LessonStoryBlock, storyBrick } from "./story";
import { teachingBrick } from "./teaching";
import { typingStoryBrick } from "./typingStory";
import { type LessonVocabularyBlock, vocabularyBrick } from "./vocabulary";
import { wordMatchBrick } from "./wordMatch";

export type LessonBodyBlock =
	| LessonTeachingSection
	| LessonVocabularyBlock
	| LessonGrammarBlock
	| LessonPatternsBlock
	| LessonStoryBlock;

export function lessonBodyBlocks(lesson: Lesson): LessonBodyBlock[] {
	if ((lesson.teachingSections?.length ?? 0) > 0) {
		return lesson.teachingSections ?? [];
	}

	const blocks: LessonBodyBlock[] = [];
	const vocab = lessonVocab(lesson);
	const storyText = lessonStoryText(lesson);

	if (vocab.length > 0) {
		blocks.push({
			id: `${lesson.id}.vocabulary`,
			type: "vocabulary",
			title: "New words",
			words: vocab,
		});
	}

	if (lesson.grammarConcepts.length > 0) {
		blocks.push({
			id: `${lesson.id}.grammar`,
			type: "grammar",
			title: "Grammar",
			concepts: lesson.grammarConcepts,
		});
	}

	if ((lesson.patterns?.length ?? 0) > 0) {
		blocks.push({
			id: `${lesson.id}.patterns`,
			type: "patterns",
			title: "Patterns",
			patterns: lesson.patterns ?? [],
		});
	}

	if (storyText) {
		blocks.push({
			id: `${lesson.id}.story`,
			type: "story",
			title: "Your story",
			intro: "Read it aloud, then type it from memory on the next screen.",
			text: storyText,
		});
	}

	return blocks;
}

type ExactLessonBodyBrickSpec = {
	[K in LessonBodyBlock["type"]]: LessonBodyBrickSpec<
		Extract<LessonBodyBlock, { type: K }>
	>;
}[LessonBodyBlock["type"]];

type LessonBodyBrickRegistry = Record<
	LessonBodyBlock["type"],
	ExactLessonBodyBrickSpec | LessonBodyBrickSpec<LessonTeachingSection>
>;

const LESSON_BODY_BRICKS: LessonBodyBrickRegistry = {
	overview: teachingBrick,
	"possessive-table": teachingBrick,
	"color-table": teachingBrick,
	examples: teachingBrick,
	vocabulary: vocabularyBrick,
	grammar: grammarBrick,
	patterns: patternsBrick,
	story: storyBrick,
};

export function lessonBodyBrickEntries(): [
	LessonBodyBlock["type"],
	LessonBodyBrickSpec<LessonBodyBlock>,
][] {
	return Object.entries(LESSON_BODY_BRICKS).map(([type, spec]) => [
		type as LessonBodyBlock["type"],
		spec as LessonBodyBrickSpec<LessonBodyBlock>,
	]);
}

function bodyBrickFor(
	block: LessonBodyBlock,
): LessonBodyBrickSpec<LessonBodyBlock> {
	return LESSON_BODY_BRICKS[block.type] as LessonBodyBrickSpec<LessonBodyBlock>;
}

export function renderLessonBodyBlock(
	block: LessonBodyBlock,
	ctx: LessonBodyRenderCtx,
) {
	return bodyBrickFor(block).render(block, ctx);
}

export function describeLessonBodyBlock(block: LessonBodyBlock): string {
	return bodyBrickFor(block).toBotContext(block);
}

export function lessonBodyGenerationSpec(
	type: LessonGeneratableBodyBrickType,
): GenerationSpec<LessonBodyBlock> {
	const generation = LESSON_BODY_BRICKS[type].generation;
	if (!generation) throw new Error(`${type} cannot generate lesson content.`);
	return generation;
}

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

function exerciseBrickFor(
	exercise: LessonExercise,
): ExerciseBrickSpec<LessonExercise> {
	return EXERCISE_BRICKS[exercise.type] as ExerciseBrickSpec<LessonExercise>;
}

export function renderExerciseBrick(
	exercise: LessonExercise,
	ctx: Parameters<ExerciseBrickSpec<LessonExercise>["render"]>[1],
) {
	return exerciseBrickFor(exercise).render(exercise, ctx);
}

export function describeExerciseBrick(
	exercise: LessonExercise,
	lesson: Lesson,
): string {
	return exerciseBrickFor(exercise).toBotContext(exercise, lesson);
}

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
