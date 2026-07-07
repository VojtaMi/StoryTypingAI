import { isObject, requiredString } from "../structuredGeneration";
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

/** Composes the lesson generation prompt from each selected brick's own shape and rules. */
export function buildLessonPrompt(
	selection: LessonGenerationSelection,
): string {
	const bodySpecs = selection.body.map(lessonBodyGenerationSpec);
	const exerciseSpecs = selection.exercises.map(exerciseGenerationSpec);
	const shape = JSON.stringify({
		title: "Short lesson title",
		lede: "One-sentence learner-facing summary",
		body: bodySpecs.map((spec) => JSON.parse(spec.shape) as unknown),
		exercises: exerciseSpecs.map((spec) => JSON.parse(spec.shape) as unknown),
	});
	const instructions = [...bodySpecs, ...exerciseSpecs]
		.map((spec) => spec.instructions)
		.join(" ");
	return (
		`Create a small Esperanto lesson for a ${selection.level} learner. ` +
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
	const parsed = JSON.parse(text) as unknown;
	if (!isObject(parsed)) throw new Error("Lesson JSON was not an object.");
	if (!Array.isArray(parsed.body))
		throw new Error("Lesson JSON is missing body.");
	if (!Array.isArray(parsed.exercises)) {
		throw new Error("Lesson JSON is missing exercises.");
	}
	if (parsed.body.length !== selection.body.length) {
		throw new Error("Lesson JSON body does not match the selected bricks.");
	}
	if (parsed.exercises.length !== selection.exercises.length) {
		throw new Error("Lesson JSON exercises do not match the selected bricks.");
	}

	const bodyBlocks = parsed.body.map((value, index) =>
		lessonBodyGenerationSpec(selection.body[index]).parse(value),
	);
	const exercises = parsed.exercises.map((value, index) =>
		exerciseGenerationSpec(selection.exercises[index]).parse(value),
	);
	const introducedWords = requiredVocabulary(bodyBlocks);
	const story = requiredStory(bodyBlocks);
	const grammarConcepts = bodyBlocks.flatMap((block) =>
		block.type === "grammar" ? block.concepts : [],
	);
	const teachingSections = bodyBlocks.filter(isTeachingSection);
	const title = requiredString(parsed.title, "lesson title", "Lesson JSON");
	const lessonId = `generated-${slugify(title)}-${Date.now()}`;

	return {
		id: lessonId,
		title,
		level: selection.level,
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
	return [storyBlock.text];
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

function slugify(value: string): string {
	const slug = value
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
	return slug || "lesson";
}
