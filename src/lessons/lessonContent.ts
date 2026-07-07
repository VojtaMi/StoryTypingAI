import type { IntroducedWord, Lesson } from "./types";

/**
 * Derived views over a lesson's content. Consumers (the tutor bot, audio
 * prefetch, word-match tiles, the vocab display) read vocabulary and story
 * text through these accessors rather than off `lesson.introducedWords` /
 * `lesson.story` directly.
 *
 * Today they return the canonical fields. This is the seam that lets those
 * fields later become `body` blocks (aggregated here) for lessons where that
 * is lossless — without touching a single consumer.
 */

export function lessonVocab(lesson: Lesson): IntroducedWord[] {
	return lesson.introducedWords;
}

export function lessonStoryText(lesson: Lesson): string {
	return lesson.story.join(" ");
}

/** Every string a lesson intro prefetches audio for: each vocabulary term, then the story. */
export function lessonNarratableTexts(lesson: Lesson): string[] {
	return [
		...lessonVocab(lesson).map((word) => word.term),
		lessonStoryText(lesson),
	];
}
