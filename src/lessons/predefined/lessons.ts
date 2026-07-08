import type { Lesson } from "../types";
import { authoredLessons } from "./authoredLessons";

const handWrittenLessons: Lesson[] = [
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
		teachingSections: [
			{
				id: "pronunciation-tip",
				type: "tip",
				title: "Pronunciation tip",
				body: [
					"Every letter in Esperanto is always pronounced — there are no silent letters. " +
						"The stress always falls on the second-to-last syllable: HUN-do, ES-tas, BES-to.",
				],
			},
		],
		story: ["Hundo estas besto."],
		exercises: [
			{
				id: "hundo-estas-besto.word-match",
				type: "word-match",
			},
			{
				id: "hundo-estas-besto.typing",
				type: "typing-story",
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
				example: "Mi estas homo.",
			},
			{
				term: "mia",
				meaning: "my",
				partOfSpeech: "possessive",
				example: "Mia ĉambro estas blua.",
			},
			{
				term: "vi",
				meaning: "you",
				partOfSpeech: "pronoun",
				example: "Vi estas homo.",
			},
			{
				term: "via",
				meaning: "your",
				partOfSpeech: "possessive",
				example: "Via aŭto estas blua.",
			},
			{
				term: "nia",
				meaning: "our",
				partOfSpeech: "possessive",
				example: "Nia hundo estas bruna.",
			},
			{
				term: "bruna",
				meaning: "brown",
				partOfSpeech: "adjective",
				example: "La hundo estas bruna.",
			},
			{
				term: "blua",
				meaning: "blue",
				partOfSpeech: "adjective",
				example: "La aŭto estas blua.",
			},
			{
				term: "blanka",
				meaning: "white",
				partOfSpeech: "adjective",
				example: "Nia ŝipo estas blanka.",
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
				slots: ["adjective", "noun"],
				examples: ["bruna hundo", "blua aŭto", "blanka ŝipo"],
			},
			{
				id: "possessive-noun",
				slots: ["possessive", "noun"],
				examples: ["mia ĉambro", "via ĉambro", "nia ĝardeno"],
			},
			{
				id: "possessive-adjective-noun",
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
	},
	{
		id: "mi-estas-homo",
		title: "Mi estas homo",
		level: "absolute-beginner",
		lede: "Meet people, names, and one cat while practicing simple sentences with estas.",
		introducedWords: [
			{
				term: "homo",
				meaning: "person / human",
				partOfSpeech: "noun",
				example: "Mi estas homo.",
			},
			{
				term: "kato",
				meaning: "cat",
				partOfSpeech: "noun",
				example: "La kato estas besto.",
			},
			{
				term: "nomo",
				meaning: "name",
				partOfSpeech: "noun",
				example: "Mia nomo estas Ana.",
			},
			{
				term: "li",
				meaning: "he",
				partOfSpeech: "pronoun",
				example: "Li estas homo.",
			},
			{
				term: "ŝi",
				meaning: "she",
				partOfSpeech: "pronoun",
				example: "Ŝi estas homo.",
			},
		],
		teachingSections: [
			{
				id: "meeting-people",
				type: "overview",
				title: "Talking about people",
				body: [
					"So far every sentence has been about a thing. This lesson is about people: who someone is, and what they are called.",
					"You already know `estas`. Everything here reuses it — only the words in front of and behind it change.",
				],
			},
		],
		grammarConcepts: [
			{
				id: "la-the",
				title: "Using la",
				explanation:
					"`la` means the. Esperanto has no separate word for a or an, so `homo` can mean a person and `la homo` means the person.",
				examples: ["la homo", "la kato", "La kato estas besto."],
			},
			{
				id: "li-si",
				title: "li and ŝi",
				explanation:
					"`li` means he and `ŝi` means she. Each can be the subject before `estas`.",
				examples: ["Li estas homo.", "Ŝi estas homo."],
			},
			{
				id: "names-with-estas",
				title: "Names with estas",
				explanation:
					"`nomo` means name. Use the same `estas` pattern to say a name: `Mia nomo estas Ana.`",
				examples: ["Mia nomo estas Ana.", "Mia nomo estas Leo."],
			},
		],
		patterns: [
			{
				id: "la-noun",
				slots: ["la", "noun"],
				examples: ["la homo", "la kato", "la nomo"],
			},
			{
				id: "pronoun-estas-noun",
				slots: ["pronoun", "estas", "noun"],
				examples: ["Mi estas homo.", "Li estas homo.", "Ŝi estas homo."],
			},
			{
				id: "nomo-estas-name",
				title: "Saying a name",
				slots: ["possessive", "nomo", "estas", "name"],
				examples: ["Mia nomo estas Ana.", "Mia nomo estas Leo."],
			},
		],
		story: [
			"Mi estas homo.",
			"Mia nomo estas Leo.",
			"Li estas homo.",
			"Ŝi estas homo.",
			"La kato estas besto.",
		],
		exercises: [
			{
				id: "mi-estas-homo.word-match",
				type: "word-match",
				title: "Connect the new words",
				hint: "Match the new people, cat, and name words.",
				completeLabel: "Complete sentences →",
			},
			{
				id: "mi-estas-homo.fill-blank",
				type: "fill-blank",
				title: "Complete the sentence",
				hint: "Choose the word the sentence is missing.",
				completeLabel: "Build sentences →",
			},
			{
				id: "mi-estas-homo.phrase-builder",
				type: "phrase-builder",
				title: "Build the sentences",
				hint: "Choose the Esperanto tiles in the right order.",
				completeLabel: "Continue to Story →",
				// Tiles are spoken on tap through the shared word-audio cache, so
				// they stay lowercase and stay off proper names.
				prompts: [
					{
						id: "mi-estas-homo",
						meaning: "I am a person.",
						answer: ["mi", "estas", "homo"],
						distractors: ["kato", "besto"],
					},
					{
						id: "si-estas-homo",
						meaning: "She is a person.",
						answer: ["ŝi", "estas", "homo"],
						distractors: ["li", "kato"],
					},
					{
						id: "la-kato-estas-besto",
						meaning: "The cat is an animal.",
						answer: ["la", "kato", "estas", "besto"],
						distractors: ["homo", "mi"],
					},
				],
			},
			{
				id: "mi-estas-homo.typing",
				type: "typing-story",
			},
		],
	},
];

/** Authored lessons append after the hand-written ones, so the indices below stay put. */
export const lessons: Lesson[] = [...handWrittenLessons, ...authoredLessons];

/** The lesson the curriculum-guided path starts with in V1. */
export const firstLesson = lessons[0];
export const gardenLesson = lessons[1];
export const miEstasHomoLesson = lessons[2];
