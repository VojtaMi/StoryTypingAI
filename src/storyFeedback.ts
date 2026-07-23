/**
 * What the learner tells us at the end of a reading story. Difficulty and the
 * practice request inform the next pedagogical handoff; the theme is a one-shot
 * subject request. Durable preferences are edited only in Settings.
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

/** The completion form's three answers. Everything except difficulty is optional. */
export interface StoryFeedbackRecord {
	difficulty: StoryDifficulty | null;
	/** What felt hard, or what the learner wants to practise next. */
	practiceRequest: string;
	/** A one-shot subject request for the next story. */
	nextStoryTheme: string;
}

export const EMPTY_STORY_FEEDBACK: StoryFeedbackRecord = {
	difficulty: null,
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
		record.practiceRequest.trim(),
	]
		.filter(Boolean)
		.join(". ");
}

/** Whether the learner actually said anything worth resolving. */
export function hasStoryFeedback(record: StoryFeedbackRecord): boolean {
	return Boolean(
		record.difficulty ||
			record.practiceRequest.trim() ||
			record.nextStoryTheme.trim(),
	);
}
