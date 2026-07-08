import { createElement } from "react";
import type { PhraseBuilderLessonExercise } from "../../types";
import type { ExerciseBrickSpec } from "../contracts";
import PhraseBuilderExercise from "./PhraseBuilderExercise";

export const phraseBuilderBrick: ExerciseBrickSpec<PhraseBuilderLessonExercise> =
	{
		example: {
			id: "phrase-builder",
			type: "phrase-builder",
			title: "Build the sentence",
			hint: "Put the words in Esperanto order.",
			prompts: [
				{
					id: "kato-en-domo",
					meaning: "The cat is in the house.",
					answer: ["La", "kato", "estas", "en", "la", "domo"],
					distractors: ["granda", "varma"],
				},
			],
			completeLabel: "Continue",
		},
		render: (exercise, ctx) =>
			createElement(PhraseBuilderExercise, {
				title: exercise.title,
				hint: exercise.hint,
				prompts: exercise.prompts,
				backgroundIntro: ctx.backgroundIntro,
				completeLabel: exercise.completeLabel,
				onComplete: ctx.onComplete,
				onBack: ctx.onBack,
			}),
		toBotContext: (exercise) =>
			[
				`## ${exercise.title}`,
				exercise.hint,
				...exercise.prompts.map(
					(prompt) => `${prompt.meaning} → ${prompt.answer.join(" ")}`,
				),
			].join("\n"),
	};

export { default as PhraseBuilderExercise } from "./PhraseBuilderExercise";
