import {
	type GenerationSpec,
	isObject,
	requiredString,
} from "../structuredGeneration";
import {
	exerciseDerivationSpec,
	type LessonGeneratableExerciseBrickType,
} from "./bricks/exerciseBricks";
import {
	type LessonBodyBlock,
	type LessonGeneratableBodyBrickType,
	lessonBodyGenerationSpec,
} from "./bricks/lessonBodyBricks";
import type {
	IntroducedWord,
	Lesson,
	LessonExercise,
	LessonLevel,
	LessonTeachingSection,
} from "./types";

/** A body brick is the only thing the model authors, so it carries the full spec. */
export interface LessonBodyGenerationBrick
	extends GenerationSpec<LessonBodyBlock> {
	type: LessonGeneratableBodyBrickType;
}

/** Exercises are derived from the parsed body; the model is never asked for them. */
export interface LessonExerciseDerivationBrick {
	type: LessonGeneratableExerciseBrickType;
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
	body: ["vocabulary", "grammar", "story"],
	exercises: ["word-match", "typing-story"],
};

export function getLessonBricks(
	selection: LessonGenerationSelection = DEFAULT_LESSON_GENERATION_SELECTION,
): LessonGenerationBricks {
	return {
		level: selection.level,
		body: selection.body.map((type) => {
			const spec = lessonBodyGenerationSpec(type);
			return {
				type,
				...spec,
			};
		}),
		exercises: selection.exercises.map((type) => {
			const spec = exerciseDerivationSpec(type);
			return {
				type,
				...spec,
			};
		}),
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
		"Keep the lesson coherent: the teaching point should explain the vocabulary/story, and the story should use the introduced words. " +
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
	const introducedWords = bricksRequireVocabulary(bricks)
		? requiredVocabulary(bodyBlocks)
		: [];
	const story = bricksRequireStory(bricks) ? requiredStory(bodyBlocks) : [];
	const grammarConcepts = bodyBlocks.flatMap((block) =>
		block.type === "grammar" ? block.concepts : [],
	);
	const teachingSections = bodyBlocks.filter(isTeachingSection);
	const title = requiredString(parsed.title, "lesson title", "Lesson JSON");
	const id = lessonId(title);

	return {
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
		resources: [],
	};
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
	return storyBlock.sentences ?? [storyBlock.text];
}

function bricksRequireVocabulary(bricks: LessonGenerationBricks) {
	return (
		bricks.body.some((brick) => brick.type === "vocabulary") ||
		bricks.exercises.some((brick) => brick.type === "word-match")
	);
}

function bricksRequireStory(bricks: LessonGenerationBricks) {
	return (
		bricks.body.some((brick) => brick.type === "story") ||
		bricks.exercises.some((brick) => brick.type === "typing-story")
	);
}

function isTeachingSection(
	block: LessonBodyBlock,
): block is LessonTeachingSection {
	return (
		block.type === "overview" ||
		block.type === "possessive-table" ||
		block.type === "color-table" ||
		block.type === "examples"
	);
}
