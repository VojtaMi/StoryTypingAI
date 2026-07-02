export interface StoryRecapWordConnectExercise {
	id: string;
	type: "word-connect";
	title: string;
	hint: string;
	pairs: Array<{
		term: string;
		meaning: string;
	}>;
}

export interface StoryRecapFillMissingWordExercise {
	id: string;
	type: "fill-missing-word";
	title: string;
	hint: string;
	sentenceBeforeBlank: string;
	sentenceAfterBlank: string;
	answer: string;
	choices: string[];
}

export interface StoryRecapQuestionExercise {
	id: string;
	type: "story-question";
	title: string;
	hint: string;
	question: string;
	answer: string;
	choices: string[];
}

export type StoryRecapExercise =
	| StoryRecapWordConnectExercise
	| StoryRecapFillMissingWordExercise
	| StoryRecapQuestionExercise;

export interface StoryRecapLesson {
	id: string;
	title: string;
	exercises: [
		StoryRecapWordConnectExercise,
		StoryRecapFillMissingWordExercise,
		StoryRecapQuestionExercise,
	];
}
