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

export interface LessonResource {
	type: "link" | "note";
	title: string;
	/** For type "link" */
	url?: string;
	/** For type "note" */
	content?: string;
}

export interface Lesson {
	id: string;
	title: string;
	level: LessonLevel;
	introducedWords: IntroducedWord[];
	grammarConcepts: GrammarConcept[];
	story: string[];
	exercises: LessonExercise[];
	resources: LessonResource[];
}

export const LESSON_LEVEL_LABELS: Record<LessonLevel, string> = {
	"absolute-beginner": "Absolute beginner",
	beginner: "Beginner",
	intermediate: "Intermediate",
};
