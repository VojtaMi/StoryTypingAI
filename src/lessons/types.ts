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

export interface LessonPattern {
	id: string;
	title: string;
	slots: string[];
	examples: string[];
}

export interface LessonOverviewSection {
	id: string;
	type: "overview";
	title: string;
	body: string[];
}

export interface LessonPossessiveTableSection {
	id: string;
	type: "possessive-table";
	title: string;
	rows: {
		pronoun: string;
		pronounMeaning: string;
		possessive: string;
		possessiveMeaning: string;
	}[];
}

export interface LessonColorTableSection {
	id: string;
	type: "color-table";
	title: string;
	rows: {
		term: string;
		meaning: string;
		color: string;
	}[];
}

export interface LessonExamplesSection {
	id: string;
	type: "examples";
	title: string;
	examples: {
		phrase: string;
		meaning: string;
	}[];
}

export type LessonTeachingSection =
	| LessonOverviewSection
	| LessonPossessiveTableSection
	| LessonColorTableSection
	| LessonExamplesSection;

export interface WordMatchLessonExercise {
	id: string;
	type: "word-match";
	title?: string;
	hint?: string;
	wordTerms?: string[];
	completeLabel?: string;
}

export interface PhraseBuilderPrompt {
	id: string;
	meaning: string;
	answer: string[];
	distractors?: string[];
}

export interface PhraseBuilderLessonExercise {
	id: string;
	type: "phrase-builder";
	title: string;
	hint: string;
	prompts: PhraseBuilderPrompt[];
	completeLabel?: string;
}

export interface TypingStoryLessonExercise {
	id: string;
	type: "typing-story";
	title?: string;
	imageUrl?: string;
}

export type LessonExercise =
	| WordMatchLessonExercise
	| PhraseBuilderLessonExercise
	| TypingStoryLessonExercise;

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
	lede?: string;
	introducedWords: IntroducedWord[];
	grammarConcepts: GrammarConcept[];
	teachingSections?: LessonTeachingSection[];
	patterns?: LessonPattern[];
	story: string[];
	storyImagePrompt?: string;
	exercises: LessonExercise[];
	resources: LessonResource[];
}

export const LESSON_LEVEL_LABELS: Record<LessonLevel, string> = {
	"absolute-beginner": "Absolute beginner",
	beginner: "Beginner",
	intermediate: "Intermediate",
};
