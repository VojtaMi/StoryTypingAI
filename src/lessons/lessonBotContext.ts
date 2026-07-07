import { describeExerciseBrick } from "./bricks/exerciseBricks";
import {
	describeLessonBodyBlock,
	lessonBodyBlocks,
} from "./bricks/lessonBodyBricks";
import { lessonStoryText, lessonVocab } from "./lessonContent";
import type { Lesson } from "./types";

export function buildLessonBotContext(lesson: Lesson): string {
	const parts: string[] = [`Lesson: ${lesson.title}`];

	const vocab = lessonVocab(lesson);
	if (vocab.length > 0) {
		parts.push("# Vocabulary");
		for (const word of vocab) {
			parts.push(`${word.term} (${word.partOfSpeech}) — ${word.meaning}`);
		}
	}

	// Vocabulary and story are surfaced from the canonical fields (above and
	// below); every other body block describes itself through its own
	// capability, so garden's tables and hundo's grammar/patterns flow through
	// one loop instead of a per-shape branch.
	const teachingBlocks = lessonBodyBlocks(lesson).filter(
		(block) => block.type !== "vocabulary" && block.type !== "story",
	);
	if (teachingBlocks.length > 0) {
		parts.push("# Teaching");
		for (const block of teachingBlocks) {
			parts.push(describeLessonBodyBlock(block));
		}
	}

	const storyText = lessonStoryText(lesson);
	if (storyText) {
		parts.push("# Practice story");
		parts.push(storyText);
	}

	if (lesson.exercises.length > 0) {
		parts.push("# Practice blocks");
		for (const exercise of lesson.exercises) {
			parts.push(describeExerciseBrick(exercise, lesson));
		}
	}

	return parts.join("\n");
}
