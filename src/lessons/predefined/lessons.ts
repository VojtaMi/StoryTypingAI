import type { Lesson } from "../types";

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
		resources: [
			{
				type: "link",
				title: "Esperanto on Duolingo",
				url: "https://www.duolingo.com/course/eo/en/Learn-Esperanto",
			},
			{
				type: "link",
				title: "Lernu! — free beginner course",
				url: "https://lernu.net/en",
			},
			{
				type: "note",
				title: "Pronunciation tip",
				content:
					"Every letter in Esperanto is always pronounced — there are no silent letters. " +
					"The stress always falls on the second-to-last syllable: HUN-do, ES-tas, BES-to.",
			},
		],
	},
];

/** The lesson the curriculum-guided path starts with in V1. */
export const firstLesson = lessons[0];
