import {
	type GenerationSpec,
	isObject,
	parseChoices,
	requiredString,
	splitOnWord,
} from "./structuredGeneration";

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

export interface StoryRecapExerciseResult {
	id: string;
	type: StoryRecapExercise["type"];
	label: string;
	attempts: number;
}

/**
 * Each exercise type owns the slice of the generation prompt it needs (its
 * JSON shape and authoring rules) and how to parse its own response, so
 * adding a new recap exercise type means adding one spec here rather than
 * editing a shared prompt string and a shared parser.
 */
type RecapExerciseSpec<T> = GenerationSpec<T>;

const wordConnectSpec: RecapExerciseSpec<StoryRecapWordConnectExercise> = {
	shape: {
		pairs: [{ term: "Esperanto word", meaning: "English meaning" }],
	},
	instructions:
		"Use exactly three word-connect pairs, using only words and facts from the story. Keep English meanings short.",
	parse(value) {
		if (
			!isObject(value) ||
			!Array.isArray(value.pairs) ||
			value.pairs.length !== 3
		) {
			throw new Error("Recap word-connect exercise needs three pairs.");
		}
		return {
			id: "word-connect",
			type: "word-connect",
			title: "Connect the words",
			hint: "Select a word, then its meaning.",
			pairs: value.pairs.map((pair) => {
				if (!isObject(pair)) throw new Error("Recap word pair is invalid.");
				return {
					term: requiredString(pair.term, "word term", "Recap JSON"),
					meaning: requiredString(pair.meaning, "word meaning", "Recap JSON"),
				};
			}),
		};
	},
};

const fillMissingWordSpec: RecapExerciseSpec<StoryRecapFillMissingWordExercise> =
	{
		shape: {
			sentence:
				"A complete, natural Esperanto sentence that contains the answer word",
			answer: "correct Esperanto word, exactly as it appears in sentence",
			choices: ["correct", "wrong", "wrong"],
		},
		instructions:
			"Use exactly three fill choices, using only words and facts from the story. " +
			"The fill sentence must be one complete, natural Esperanto sentence containing the answer word written exactly as in `answer` — the app carves the blank out of it itself, so write a normal sentence and do not pre-split it or omit the word.",
		parse(value) {
			if (!isObject(value)) throw new Error("Recap fill exercise is invalid.");
			const answer = requiredString(value.answer, "fill answer", "Recap JSON");
			const sentence = requiredString(
				value.sentence,
				"fill sentence",
				"Recap JSON",
			);
			const { before, after } = splitOnWord(
				sentence,
				answer,
				"Recap fill sentence does not contain the answer word.",
			);
			return {
				id: "fill-missing-word",
				type: "fill-missing-word",
				title: "Fill the missing word",
				hint: "Choose the word that completes the sentence.",
				sentenceBeforeBlank: before,
				sentenceAfterBlank: after,
				answer,
				choices: parseChoices(
					value.choices,
					answer,
					3,
					3,
					"Recap choices do not include the answer.",
					"Recap JSON",
				),
			};
		},
	};

const storyQuestionSpec: RecapExerciseSpec<StoryRecapQuestionExercise> = {
	shape: {
		question: "Simple English question about the story",
		answer: "correct answer",
		choices: ["correct", "wrong"],
	},
	instructions:
		"Use two or three story-question choices, using only facts from the story.",
	parse(value) {
		if (!isObject(value)) throw new Error("Recap story question is invalid.");
		const answer = requiredString(
			value.answer,
			"story question answer",
			"Recap JSON",
		);
		return {
			id: "story-question",
			type: "story-question",
			title: "Story question",
			hint: "Choose the answer that fits the story.",
			question: requiredString(value.question, "story question", "Recap JSON"),
			answer,
			choices: parseChoices(
				value.choices,
				answer,
				2,
				3,
				"Recap choices do not include the answer.",
				"Recap JSON",
			),
		};
	},
};

const RECAP_EXERCISE_SPECS = [
	wordConnectSpec,
	fillMissingWordSpec,
	storyQuestionSpec,
];

/** Composes the recap generation prompt from each exercise type's own shape and rules. */
export function buildStoryRecapPrompt(): string {
	const shape = JSON.stringify({
		exercises: RECAP_EXERCISE_SPECS.map((spec) => spec.shape),
	});
	const instructions = RECAP_EXERCISE_SPECS.map(
		(spec) => spec.instructions,
	).join(" ");
	return (
		"Create a tiny end-of-story Esperanto recap lesson for a beginner. " +
		"Return only valid JSON with this exact shape: " +
		`${shape} ` +
		`${instructions} ` +
		"Do not include markdown, comments, explanations, trailing commas, or extra fields."
	);
}

export function parseStoryRecapLesson(text: string): StoryRecapLesson {
	const parsed = JSON.parse(text) as unknown;
	if (!isObject(parsed)) throw new Error("Recap JSON was not an object.");
	if (!Array.isArray(parsed.exercises)) {
		throw new Error("Recap JSON is missing exercises.");
	}
	return {
		id: `story-recap-${Date.now()}`,
		title: "Eta praktiko",
		exercises: [
			wordConnectSpec.parse(parsed.exercises[0]),
			fillMissingWordSpec.parse(parsed.exercises[1]),
			storyQuestionSpec.parse(parsed.exercises[2]),
		],
	};
}
