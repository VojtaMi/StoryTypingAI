export type LessonLevel = "absolute-beginner" | "beginner" | "intermediate";

export interface IntroducedWord {
	term: string;
	meaning: string;
	partOfSpeech: string;
	example: string;
}

export interface GrammarConcept {
	id: string;
	title: string;
	explanation: string;
	examples: string[];
}

/** Reserved for the future adaptive exercise system; V1 lessons have none. */
export type LessonExercise = never;

export interface Lesson {
	id: string;
	title: string;
	level: LessonLevel;
	introducedWords: IntroducedWord[];
	grammarConcepts: GrammarConcept[];
	story: string[];
	exercises: LessonExercise[];
}

export const LESSON_LEVEL_LABELS: Record<LessonLevel, string> = {
	"absolute-beginner": "Absolute beginner",
	beginner: "Beginner",
	intermediate: "Intermediate",
};
