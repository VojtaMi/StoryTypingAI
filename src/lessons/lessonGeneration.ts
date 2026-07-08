import { isObject, requiredString, slugify } from "../structuredGeneration";
import {
	exerciseGenerationSpec,
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
	LessonLevel,
	LessonTeachingSection,
} from "./types";

type LessonGenerationBrickKind = "body" | "exercise";

export interface LessonGenerationBrick<
	TType extends string = string,
	TKind extends LessonGenerationBrickKind = LessonGenerationBrickKind,
> {
	kind: TKind;
	type: TType;
	description: string;
	shape: unknown;
	instructions: string;
}

export interface LessonGenerationBricks {
	level: LessonLevel;
	body: LessonGenerationBrick<LessonGeneratableBodyBrickType, "body">[];
	exercises: LessonGenerationBrick<
		LessonGeneratableExerciseBrickType,
		"exercise"
	>[];
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
				kind: "body",
				type,
				description: `Lesson body brick: ${type}`,
				shape: parseSpecShape(spec.shape),
				instructions: spec.instructions,
			};
		}),
		exercises: selection.exercises.map((type) => {
			const spec = exerciseGenerationSpec(type);
			return {
				kind: "exercise",
				type,
				description: `Lesson exercise brick: ${type}`,
				shape: parseSpecShape(spec.shape),
				instructions: spec.instructions,
			};
		}),
	};
}

/** Composes the lesson generation prompt from each selected brick's own shape and rules. */
export function buildLessonPrompt(
	selection: LessonGenerationSelection,
): string {
	return buildLessonPromptFromBricks(getLessonBricks(selection));
}

export function buildLessonPromptFromBricks(
	bricks: LessonGenerationBricks,
): string {
	const shape = JSON.stringify({
		title: "Short lesson title",
		lede: "One-sentence learner-facing summary",
		body: bricks.body.map((brick) => brick.shape),
		exercises: bricks.exercises.map((brick) => brick.shape),
	});
	const instructions = [...bricks.body, ...bricks.exercises]
		.map((brick) => brick.instructions)
		.join(" ");
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
	selection: LessonGenerationSelection,
): Lesson {
	return parseGeneratedLessonFromBricks(text, getLessonBricks(selection));
}

export function parseGeneratedLessonFromBricks(
	text: string,
	bricks: LessonGenerationBricks,
): Lesson {
	const parsed = JSON.parse(text) as unknown;
	if (!isObject(parsed)) throw new Error("Lesson JSON was not an object.");
	if (!Array.isArray(parsed.body))
		throw new Error("Lesson JSON is missing body.");
	if (!Array.isArray(parsed.exercises)) {
		throw new Error("Lesson JSON is missing exercises.");
	}
	if (parsed.body.length !== bricks.body.length) {
		throw new Error("Lesson JSON body does not match the selected bricks.");
	}
	if (parsed.exercises.length !== bricks.exercises.length) {
		throw new Error("Lesson JSON exercises do not match the selected bricks.");
	}

	const bodyBlocks = parsed.body.map((value, index) =>
		lessonBodyGenerationSpec(bricks.body[index].type).parse(value),
	);
	const exercises = parsed.exercises.map((value, index) =>
		exerciseGenerationSpec(bricks.exercises[index].type).parse(value),
	);
	const introducedWords = selectionRequiresVocabulary(bricks)
		? requiredVocabulary(bodyBlocks)
		: [];
	const story = selectionRequiresStory(bricks) ? requiredStory(bodyBlocks) : [];
	const grammarConcepts = bodyBlocks.flatMap((block) =>
		block.type === "grammar" ? block.concepts : [],
	);
	const teachingSections = bodyBlocks.filter(isTeachingSection);
	const title = requiredString(parsed.title, "lesson title", "Lesson JSON");
	const lessonId = `generated-${slugify(title, "lesson")}-${Date.now()}`;

	return {
		id: lessonId,
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
			id: `${lessonId}.${exercise.id}`,
		})),
		resources: [],
	};
}

function parseSpecShape(shape: string): unknown {
	return JSON.parse(shape) as unknown;
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

function selectionRequiresVocabulary(bricks: LessonGenerationBricks) {
	return (
		bricks.body.some((brick) => brick.type === "vocabulary") ||
		bricks.exercises.some((brick) => brick.type === "word-match")
	);
}

function selectionRequiresStory(bricks: LessonGenerationBricks) {
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
