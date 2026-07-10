import {
	type GenerationSpec,
	isObject,
	requiredString,
} from "../structuredGeneration";
import {
	assertLessonExercises,
	exerciseDerivationSpec,
	type LessonBodyBlock,
	type LessonGeneratableBodyBrickType,
	type LessonGeneratableExerciseBrickType,
	lessonBodyGenerationSpec,
	STORY_BODY_BRICK_TYPE,
	VOCABULARY_BODY_BRICK_TYPE,
} from "./bricks";
import type {
	IntroducedWord,
	Lesson,
	LessonAuthoredBodyBlock,
	LessonExercise,
	LessonLevel,
} from "./types";

/** A body brick is the only thing the model authors, so it carries the full spec. */
export interface LessonBodyGenerationBrick
	extends GenerationSpec<LessonBodyBlock> {
	type: LessonGeneratableBodyBrickType;
}

/** Exercises are derived from the parsed body; the model is never asked for them. */
export interface LessonExerciseDerivationBrick {
	type: LessonGeneratableExerciseBrickType;
	requires: LessonGeneratableBodyBrickType;
	create(): LessonExercise;
}

export interface LessonGenerationBricks {
	level: LessonLevel;
	body: LessonBodyGenerationBrick[];
	exercises: LessonExerciseDerivationBrick[];
}

export interface LessonGenerationSelection {
	level: LessonLevel;
	body: LessonGeneratableBodyBrickType[];
	exercises: LessonGeneratableExerciseBrickType[];
}

export const DEFAULT_LESSON_GENERATION_SELECTION: LessonGenerationSelection = {
	level: "absolute-beginner",
	body: ["vocabulary", "grammar"],
	exercises: ["word-match", "short-typing"],
};

export function getLessonBricks(
	selection: LessonGenerationSelection = DEFAULT_LESSON_GENERATION_SELECTION,
): LessonGenerationBricks {
	const body = selection.body.map((type) => {
		const spec = lessonBodyGenerationSpec(type);
		return {
			type,
			...spec,
		};
	});
	const exercises = selection.exercises.map((type) => {
		const spec = exerciseDerivationSpec(type);
		return {
			type,
			...spec,
		};
	});
	validateExerciseRequirements(body, exercises);

	return {
		level: selection.level,
		body,
		exercises,
	};
}

/** Composes the lesson generation prompt from each selected body brick's own shape and rules. */
export function buildLessonPrompt(bricks: LessonGenerationBricks): string {
	const shape = JSON.stringify({
		title: "Short lesson title",
		lede: "One-sentence learner-facing summary",
		body: bricks.body.map((brick) => brick.shape),
	});
	const instructions = bricks.body.map((brick) => brick.instructions).join(" ");
	return (
		`Create a small Esperanto lesson for a ${bricks.level} learner. ` +
		"Return only valid JSON with this exact shape: " +
		`${shape} ` +
		`${instructions} ` +
		"Keep the lesson coherent: the teaching point should explain the vocabulary and selected practice content. " +
		"Do not include markdown, comments, explanations, trailing commas, or extra fields."
	);
}

export function parseGeneratedLesson(
	text: string,
	bricks: LessonGenerationBricks,
	lessonId: (title: string) => string,
): Lesson {
	const parsed = JSON.parse(text) as unknown;
	if (!isObject(parsed)) throw new Error("Lesson JSON was not an object.");
	if (!Array.isArray(parsed.body))
		throw new Error("Lesson JSON is missing body.");
	if (parsed.body.length !== bricks.body.length) {
		throw new Error("Lesson JSON body does not match the selected bricks.");
	}

	const bodyBlocks = parsed.body.map((value, index) =>
		bricks.body[index].parse(value),
	);
	const exercises = bricks.exercises.map((brick) => brick.create());
	const neededBodyTypes = lessonFieldBodyTypes(bricks);
	const introducedWords = neededBodyTypes.has(VOCABULARY_BODY_BRICK_TYPE)
		? requiredVocabulary(bodyBlocks)
		: [];
	const story = neededBodyTypes.has(STORY_BODY_BRICK_TYPE)
		? requiredStory(bodyBlocks)
		: [];
	const grammarConcepts = bodyBlocks.flatMap((block) =>
		block.type === "grammar" ? block.concepts : [],
	);
	const teachingSections = bodyBlocks.filter(isTeachingSection);
	const title = requiredString(parsed.title, "lesson title", "Lesson JSON");
	const id = lessonId(title);

	const lesson: Lesson = {
		id,
		title,
		level: bricks.level,
		lede: requiredString(parsed.lede, "lesson lede", "Lesson JSON"),
		introducedWords,
		grammarConcepts,
		teachingSections:
			teachingSections.length > 0 ? teachingSections : undefined,
		story,
		exercises: exercises.map((exercise) => ({
			...exercise,
			id: `${id}.${exercise.id}`,
		})),
	};

	// The derived exercises were built from the bricks, not from this lesson.
	// Prove they can actually render against it before anyone stores it.
	assertLessonExercises(lesson);
	return lesson;
}

function requiredVocabulary(blocks: LessonBodyBlock[]): IntroducedWord[] {
	const vocabBlock = blocks.find((block) => block.type === "vocabulary");
	if (vocabBlock?.type !== "vocabulary") {
		throw new Error("Generated lesson is missing vocabulary.");
	}
	return vocabBlock.words;
}

function requiredStory(blocks: LessonBodyBlock[]): string[] {
	const storyBlock = blocks.find((block) => block.type === "story");
	if (storyBlock?.type !== "story") {
		throw new Error("Generated lesson is missing a story.");
	}
	return storyBlock.sentences;
}

function validateExerciseRequirements(
	body: LessonBodyGenerationBrick[],
	exercises: LessonExerciseDerivationBrick[],
) {
	const selectedBodyTypes = new Set(body.map((brick) => brick.type));
	for (const exercise of exercises) {
		if (!selectedBodyTypes.has(exercise.requires)) {
			throw new Error(
				`Exercise brick "${exercise.type}" requires the "${exercise.requires}" body brick.`,
			);
		}
	}
}

function lessonFieldBodyTypes(
	bricks: LessonGenerationBricks,
): Set<LessonGeneratableBodyBrickType> {
	return new Set([
		...bricks.body.map((brick) => brick.type),
		...bricks.exercises.map((brick) => brick.requires),
	]);
}

function isTeachingSection(
	block: LessonBodyBlock,
): block is LessonAuthoredBodyBlock {
	return (
		block.type === "overview" ||
		block.type === "possessive-table" ||
		block.type === "color-table" ||
		block.type === "examples" ||
		block.type === "tip"
	);
}
