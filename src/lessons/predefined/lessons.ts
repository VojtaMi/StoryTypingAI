import type { Lesson } from "../types";

export const lessons: Lesson[] = [
	{
		id: "hundo-estas-besto",
		title: "Hundo estas besto",
		level: "absolute-beginner",
		lede: "A first taste of Esperanto: 3 new words and one tiny sentence you'll be able to read, understand, and type by the end.",
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
	{
		id: "nia-gardeno",
		title: "Nia ĝardeno",
		level: "absolute-beginner",
		lede: "Learn to describe familiar things in a tiny garden scene.",
		introducedWords: [
			{
				term: "mi",
				meaning: "I / me",
				partOfSpeech: "pronoun",
				example: "Mi.",
			},
			{
				term: "mia",
				meaning: "my",
				partOfSpeech: "possessive",
				example: "Mia ĉambro.",
			},
			{
				term: "vi",
				meaning: "you",
				partOfSpeech: "pronoun",
				example: "Vi.",
			},
			{
				term: "via",
				meaning: "your",
				partOfSpeech: "possessive",
				example: "Via ĉambro.",
			},
			{
				term: "nia",
				meaning: "our",
				partOfSpeech: "possessive",
				example: "Nia ĝardeno.",
			},
			{
				term: "bruna",
				meaning: "brown",
				partOfSpeech: "adjective",
				example: "Bruna hundo.",
			},
			{
				term: "blua",
				meaning: "blue",
				partOfSpeech: "adjective",
				example: "Blua aŭto.",
			},
			{
				term: "blanka",
				meaning: "white",
				partOfSpeech: "adjective",
				example: "Blanka ŝipo.",
			},
		],
		grammarConcepts: [
			{
				id: "adjectives-before-nouns",
				title: "Colors as adjectives",
				explanation:
					"An adjective can describe a noun. In these first patterns, the adjective comes before the noun: `bruna hundo`.",
				examples: ["bruna hundo", "blua aŭto", "blanka ŝipo"],
			},
			{
				id: "mi-mia-nia",
				title: "mi, mia, nia",
				explanation: "`mi` means I or me. `mia` means my. `nia` means our.",
				examples: ["mia ĉambro", "nia ĝardeno"],
			},
		],
		teachingSections: [
			{
				id: "describe-things",
				type: "overview",
				title: "Describing things",
				body: [
					"Esperanto adjectives describe nouns and regularly end in `-a`.",
					"In this lesson, we describe who something belongs to and what color it is.",
				],
			},
			{
				id: "personal-adjectives",
				type: "possessive-table",
				title: "Personal adjectives",
				rows: [
					{
						pronoun: "mi",
						pronounMeaning: "I / me",
						possessive: "mia",
						possessiveMeaning: "my",
					},
					{
						pronoun: "vi",
						pronounMeaning: "you",
						possessive: "via",
						possessiveMeaning: "your",
					},
					{
						pronoun: "ni",
						pronounMeaning: "we / us",
						possessive: "nia",
						possessiveMeaning: "our",
					},
				],
			},
			{
				id: "colors",
				type: "color-table",
				title: "Colors",
				rows: [
					{ term: "bruna", meaning: "brown", color: "#8a5a2b" },
					{ term: "blua", meaning: "blue", color: "#2f74c0" },
					{ term: "blanka", meaning: "white", color: "#fffdf7" },
				],
			},
			{
				id: "combined-examples",
				type: "examples",
				title: "Examples",
				examples: [
					{ phrase: "bruna hundo", meaning: "brown dog" },
					{ phrase: "mia aŭto", meaning: "my car" },
					{ phrase: "via ĉambro", meaning: "your room" },
					{ phrase: "nia blanka ŝipo", meaning: "our white ship" },
				],
			},
		],
		patterns: [
			{
				id: "adjective-noun",
				title: "Adjective + noun",
				slots: ["adjective", "noun"],
				examples: ["bruna hundo", "blua aŭto", "blanka ŝipo"],
			},
			{
				id: "possessive-noun",
				title: "Possessive + noun",
				slots: ["possessive", "noun"],
				examples: ["mia ĉambro", "via ĉambro", "nia ĝardeno"],
			},
			{
				id: "possessive-adjective-noun",
				title: "Possessive + adjective + noun",
				slots: ["possessive", "adjective", "noun"],
				examples: ["nia blanka ŝipo"],
			},
		],
		story: [
			"Nia ĝardeno.",
			"Bruna hundo.",
			"Blua aŭto.",
			"Blanka ŝipo.",
			"Mia ĉambro.",
		],
		storyImagePrompt:
			"A warm illustrated Esperanto lesson scene: a garden with a brown dog, a blue car, a small white toy ship, and a cozy room visible through an open window.",
		exercises: [
			{
				id: "nia-gardeno.word-match",
				type: "word-match",
				title: "Connect the new words",
				hint: "Match the colors and ownership words to their meanings.",
				wordTerms: ["mia", "nia", "blua", "blanka"],
				completeLabel: "Build phrases →",
			},
			{
				id: "nia-gardeno.phrase-builder",
				type: "phrase-builder",
				title: "Build the phrases",
				hint: "Choose the Esperanto tiles in the right order.",
				completeLabel: "Continue to Story →",
				prompts: [
					{
						id: "bruna-hundo",
						meaning: "brown dog",
						answer: ["bruna", "hundo"],
						distractors: ["blua", "aŭto"],
					},
					{
						id: "blua-auto",
						meaning: "blue car",
						answer: ["blua", "aŭto"],
						distractors: ["blanka", "hundo"],
					},
					{
						id: "blanka-sipo",
						meaning: "our white ship",
						answer: ["nia", "blanka", "ŝipo"],
						distractors: ["bruna", "ĉambro", "mia"],
					},
				],
			},
			{
				id: "nia-gardeno.typing",
				type: "typing-story",
				imageUrl: "/images/nia-gardeno-typing-bg.webp",
			},
		],
		resources: [
			{
				type: "note",
				title: "Tiny story pattern",
				content:
					"This lesson reuses older nouns with new adjective and ownership patterns, so later lessons can generate many more combinations from the same slots.",
			},
		],
	},
];

/** The lesson the curriculum-guided path starts with in V1. */
export const firstLesson = lessons[0];
export const gardenLesson = lessons[1];
