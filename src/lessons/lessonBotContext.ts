import { describeExerciseBrick } from "./bricks/exerciseBricks";
import {
	describeLessonBodyBlock,
	type LessonBodyBlock,
	lessonBodyBlocks,
} from "./bricks/lessonBodyBricks";
import { lessonStoryText, lessonVocab } from "./lessonContent";
import type { Lesson } from "./types";

function blockOfType<T extends LessonBodyBlock["type"]>(
	blocks: LessonBodyBlock[],
	type: T,
): Extract<LessonBodyBlock, { type: T }> | undefined {
	return blocks.find((block) => block.type === type) as
		| Extract<LessonBodyBlock, { type: T }>
		| undefined;
}

export function buildLessonBotContext(lesson: Lesson): string {
	const parts: string[] = [`Lesson: ${lesson.title}`];
	const bodyBlocks = lessonBodyBlocks(lesson);

	const vocab = lessonVocab(lesson);
	if (vocab.length > 0) {
		parts.push("# Vocabulary");
		for (const word of vocab) {
			parts.push(`${word.term} (${word.partOfSpeech}) — ${word.meaning}`);
		}
	}

	if ((lesson.teachingSections?.length ?? 0) > 0) {
		parts.push("# Teaching");
		for (const block of bodyBlocks) {
			parts.push(describeLessonBodyBlock(block));
		}
	} else {
		const grammarBlock = blockOfType(bodyBlocks, "grammar");
		if (grammarBlock) {
			parts.push("# Grammar");
			parts.push(describeLessonBodyBlock(grammarBlock));
		}

		const patternsBlock = blockOfType(bodyBlocks, "patterns");
		if (patternsBlock) {
			parts.push("# Patterns");
			parts.push(describeLessonBodyBlock(patternsBlock));
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
