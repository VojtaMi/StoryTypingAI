/**
 * What the learner tells us at the end of a reading story, and how it is
 * carried. The four answers have genuinely different destinations — difficulty
 * and the practice request describe ability and steer the next objective, the
 * taste note is durable story preference, the theme is a one-shot subject
 * request — so they travel as separate fields rather than as one prose blob
 * that the server would have to take apart again.
 */

export const STORY_DIFFICULTIES = [
	"tooEasy",
	"bitEasy",
	"right",
	"bitHard",
	"tooHard",
] as const;

export type StoryDifficulty = (typeof STORY_DIFFICULTIES)[number];

export function isStoryDifficulty(value: unknown): value is StoryDifficulty {
	return STORY_DIFFICULTIES.includes(value as StoryDifficulty);
}

/** The completion form's four answers. Everything except difficulty is optional. */
export interface StoryFeedbackRecord {
	difficulty: StoryDifficulty | null;
	/** Durable story taste: what the learner wants more or less of. */
	taste: string;
	/** What felt hard, or what the learner wants to practise next. */
	practiceRequest: string;
	/** A one-shot subject request for the next story. */
	nextStoryTheme: string;
}

export const EMPTY_STORY_FEEDBACK: StoryFeedbackRecord = {
	difficulty: null,
	taste: "",
	practiceRequest: "",
	nextStoryTheme: "",
};

/** How each difficulty reads to the learner, and in a saved story's summary. */
export const STORY_DIFFICULTY_LABEL: Record<StoryDifficulty, string> = {
	tooEasy: "Too easy",
	bitEasy: "A bit easy",
	right: "Just right",
	bitHard: "A bit hard",
	tooHard: "Too hard",
};

/**
 * A human-readable summary of what the learner said, for showing on a reopened
 * story. This is a display artifact only: the evidence the server reasons over
 * keeps the fields separate.
 */
export function formatStoryFeedback(record: StoryFeedbackRecord): string {
	return [
		record.difficulty ? STORY_DIFFICULTY_LABEL[record.difficulty] : "",
		record.taste.trim(),
		record.practiceRequest.trim(),
	]
		.filter(Boolean)
		.join(". ");
}

/** Whether the learner actually said anything worth resolving. */
export function hasStoryFeedback(record: StoryFeedbackRecord): boolean {
	return Boolean(
		record.difficulty ||
			record.taste.trim() ||
			record.practiceRequest.trim() ||
			record.nextStoryTheme.trim(),
	);
}
