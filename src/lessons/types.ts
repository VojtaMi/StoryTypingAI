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
	/** Only when it says something the slots do not. `la + noun` names itself. */
	title?: string;
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

export interface LessonVocabularyBlock {
	id: string;
	type: "vocabulary";
	title: string;
	words: IntroducedWord[];
}

export interface LessonGrammarBlock {
	id: string;
	type: "grammar";
	title: string;
	concepts: GrammarConcept[];
}

export interface LessonPatternsBlock {
	id: string;
	type: "patterns";
	title: string;
	patterns: LessonPattern[];
}

export interface LessonStoryBlock {
	id: string;
	type: "story";
	title: string;
	intro: string;
	sentences: string[];
}

export interface LessonResourcesBlock {
	id: string;
	type: "resources";
	title: string;
	resources: LessonResource[];
}

/**
 * Every shape the lesson doc can render, keyed by `type`. Declared here rather
 * than in `bricks/registry.ts` (where the registry that consumes it lives)
 * because `types.ts` is imported by every script, and `registry.ts` reaches
 * React components, the chat modal, and CSS side-effects. `LessonExercise`
 * below is the same arrangement.
 */
export type LessonBodyBlock =
	| LessonTeachingSection
	| LessonVocabularyBlock
	| LessonGrammarBlock
	| LessonPatternsBlock
	| LessonStoryBlock
	| LessonResourcesBlock;

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

/**
 * Prompts are not stored: they are carved out of `IntroducedWord.example` at
 * render time by `promptsForFillBlank`, so the blank can never disagree with
 * the vocabulary it tests. `wordTerms` narrows which words are drilled.
 */
export interface FillBlankLessonExercise {
	id: string;
	type: "fill-blank";
	title?: string;
	hint?: string;
	wordTerms?: string[];
	completeLabel?: string;
}

export type LessonExercise =
	| WordMatchLessonExercise
	| PhraseBuilderLessonExercise
	| FillBlankLessonExercise
	| TypingStoryLessonExercise;

/** A link without a URL, or a note without content, must fail to compile. */
export type LessonResource =
	| { type: "link"; title: string; url: string }
	| { type: "note"; title: string; content: string };

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
