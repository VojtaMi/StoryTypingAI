import {
	describeExerciseBrick,
	describeLessonBodyBlock,
	lessonBodyBlocks,
} from "./bricks";
import type { Lesson } from "./types";

export function buildLessonBotContext(lesson: Lesson): string {
	const parts: string[] = [`Lesson: ${lesson.title}`];

	// Every block describes itself through its own capability, so the garden's
	// tables, hundo's grammar, and each word's example sentence flow through one
	// loop instead of a per-shape branch. Hand-rolling vocabulary and story here
	// is what used to make `vocabularyBrick.toBotContext` unreachable.
	const blocks = lessonBodyBlocks(lesson);
	if (blocks.length > 0) {
		parts.push("# Teaching");
		for (const block of blocks) {
			parts.push(`## ${block.title}`);
			parts.push(describeLessonBodyBlock(block));
		}
	}

	if (lesson.exercises.length > 0) {
		parts.push("# Practice blocks");
		for (const exercise of lesson.exercises) {
			parts.push(describeExerciseBrick(exercise, lesson));
		}
	}

	return parts.join("\n");
}
