import { describeExerciseBrick } from "./bricks/exerciseBricks";
import { describeTeachingSection } from "./bricks/teachingBricks";
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

	if ((lesson.teachingSections?.length ?? 0) > 0) {
		parts.push("# Teaching");
		for (const section of lesson.teachingSections ?? []) {
			parts.push(describeTeachingSection(section));
		}
	} else {
		if (lesson.grammarConcepts.length > 0) {
			parts.push("# Grammar");
			for (const concept of lesson.grammarConcepts) {
				parts.push(`${concept.title}: ${concept.explanation}`);
				if (concept.examples.length > 0) {
					parts.push(`Examples: ${concept.examples.join("; ")}`);
				}
			}
		}
		if ((lesson.patterns?.length ?? 0) > 0) {
			parts.push("# Patterns");
			for (const pattern of lesson.patterns ?? []) {
				parts.push(
					`${pattern.title}: ${pattern.slots.join(" + ")}. Examples: ${pattern.examples.join("; ")}`,
				);
			}
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
