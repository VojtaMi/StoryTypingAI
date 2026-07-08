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

export function lessonStory(lesson: Lesson): string[] {
	return lesson.story;
}

/** The story as one narratable string. Also the cache key for its audio. */
export function lessonStoryText(lesson: Lesson): string {
	return lessonStory(lesson).join(" ");
}

/** Lesson-scoped narration text; vocabulary audio is handled by the shared word cache. */
export function lessonNarratableTexts(lesson: Lesson): string[] {
	return [lessonStoryText(lesson)].filter(Boolean);
}
