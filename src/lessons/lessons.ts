import type { Lesson } from "./types";

export const lessons: Lesson[] = [
	{
		id: "hundo-estas-besto",
		title: "Hundo estas besto",
		level: "absolute-beginner",
		introducedWords: [
			{
				term: "hundo",
				meaning: "dog",
				partOfSpeech: "noun",
				example: "Hundo estas besto.",
			},
			{
				term: "estas",
				meaning: "is / are",
				partOfSpeech: "verb",
				example: "Hundo estas besto.",
			},
			{
				term: "besto",
				meaning: "animal",
				partOfSpeech: "noun",
				example: "Hundo estas besto.",
			},
		],
		grammarConcepts: [
			{
				id: "estas-copula",
				title: "Using estas",
				explanation: "`estas` connects one thing with what it is.",
				examples: ["Hundo estas besto."],
			},
		],
		story: ["Hundo estas besto."],
		exercises: [],
	},
];

/** The lesson the curriculum-guided path starts with in V1. */
export const firstLesson = lessons[0];
