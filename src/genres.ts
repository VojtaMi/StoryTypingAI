import type { NextStoryBrief } from "./nextStoryBrief";

export type GenreId = "esperanto" | "german" | "spanish";

export interface Genre {
	id: GenreId;
	label: string;
	shortCode: string;
	emoji: string;
	color: string;
	systemPrompt: string;
	heroImageUrl: string;
	botImageUrl: string;
	faviconUrl: string;
	botTeachingTopics: string;
	beginnerLanguageGuidance: string;
	grammarRequirements: string;
	recapTitle: string;
	recapAnswerExample: string;
	ttsInstructions: string;
	starterBrief: NextStoryBrief;
	seeds: string[];
}

export const genres: Genre[] = [
	{
		id: "esperanto",
		label: "Esperanto",
		shortCode: "EO",
		emoji: "★",
		color: "#38b26d",
		systemPrompt: "Create an engaging Esperanto story of your choice.",
		heroImageUrl: "/images/esperanto-lesson-hero.png",
		botImageUrl: "/images/esperanto-bot-retro.png",
		faviconUrl: "/favicon-esperanto.svg?v=3",
		botTeachingTopics:
			"vocabulary, roots, affixes, grammar, pronunciation, and why sentences mean what they mean",
		beginnerLanguageGuidance:
			"Prefer the basic tense required by language.focus; otherwise prefer present-tense copular, positional, and intransitive constructions. Repeat explicit nouns when that is clearer than pronouns or complex references. Avoid plurals and direct objects unless language.focus introduces them; rephrase grammatically instead of dropping required endings.",
		grammarRequirements:
			"Never simplify by dropping required accusative, plural, or agreement endings.",
		recapTitle: "Eta praktiko",
		recapAnswerExample: "pensas pri",
		ttsInstructions:
			"Keep Esperanto pronunciation careful, natural, and learner-friendly.",
		starterBrief: {
			themeSuggestion: "",
			narrativeScale: "minimal",
			language: {
				focus:
					"Simple present-tense sentences with concrete beginner words; avoid plurals and direct objects.",
				progression: "establish",
				complexity: "absolute beginner",
				calibrationSnippets: [
					"Petro estas viro. Petro sidas en ĝardeno. Simo estas hundo. Simo dormas apud Petro.",
				],
			},
		},
		seeds: [],
	},
	{
		id: "german",
		label: "German",
		shortCode: "DE",
		emoji: "★",
		color: "#38b26d",
		systemPrompt:
			"Create an engaging German story of your choice. Write the story prose in clear, natural German for a true beginner; keep explanations and metadata in English.",
		heroImageUrl: "/images/german-story-hero.png",
		botImageUrl: "/images/german-bot.png",
		faviconUrl: "/favicon-german.svg?v=3",
		botTeachingTopics:
			"vocabulary, cases, gender and articles, verb person and tense, word order, separable verbs, and pronunciation",
		beginnerLanguageGuidance:
			"Prefer present tense. Keep all nouns capitalized, use der/die/das and adjective forms correctly, and use nominative, accusative, and dative cases correctly. Keep main clauses verb-second, subordinate clauses verb-final, and use separable verbs naturally; avoid genitive, Konjunktiv, and complex subordination.",
		grammarRequirements:
			"Use the three genders and der/die/das with correct adjective endings; use nominative, accusative, and dative correctly; keep main clauses verb-second and subordinate clauses verb-final; use separable verbs naturally; capitalize every noun. Prefer present tense and avoid genitive, Konjunktiv, and complex subordination.",
		recapTitle: "Kleine Übung",
		recapAnswerExample: "steht auf",
		ttsInstructions:
			"Keep German pronunciation clear, natural, and learner-friendly.",
		starterBrief: {
			themeSuggestion: "",
			narrativeScale: "minimal",
			language: {
				focus:
					"Simple present-tense German sentences with concrete beginner words; practise the three genders and articles (`der`, `die`, `das`) with basic nominative and accusative forms.",
				progression: "establish",
				complexity: "absolute beginner",
				calibrationSnippets: [
					"Peter ist ein Mann. Peter ist in einem Garten. Bello ist ein Hund. Bello schläft neben Peter.",
				],
			},
		},
		seeds: [],
	},
	{
		id: "spanish",
		label: "Spanish",
		shortCode: "ES",
		emoji: "★",
		color: "#38b26d",
		systemPrompt:
			"Create an engaging Spanish story of your choice. Write the story prose in clear, natural Spanish for a true beginner; keep explanations and metadata in English.",
		heroImageUrl: "/images/spanish-story-hero.png",
		botImageUrl: "/images/spanish-bot.png",
		faviconUrl: "/favicon-spanish.svg?v=3",
		botTeachingTopics:
			"vocabulary, gender and agreement, verb conjugation and tense, ser and estar, pronunciation, and why sentences mean what they mean",
		beginnerLanguageGuidance:
			"Prefer the basic tense required by language.focus; otherwise prefer present-tense copular, positional, and intransitive constructions. Repeat explicit nouns when that is clearer than pronouns or complex references. Keep noun/adjective gender and number agreement correct, conjugate verbs correctly, and use ser and estar appropriately.",
		grammarRequirements:
			"Maintain noun/adjective gender and number agreement, correct verb conjugation, and correct use of ser and estar.",
		recapTitle: "Práctica breve",
		recapAnswerExample: "piensa en",
		ttsInstructions:
			"Keep Spanish pronunciation clear, natural, and learner-friendly.",
		starterBrief: {
			themeSuggestion: "",
			narrativeScale: "minimal",
			language: {
				focus:
					"Simple present-tense Spanish sentences with concrete beginner words; practise basic gender and number agreement and the verbs `ser` and `estar`.",
				progression: "establish",
				complexity: "absolute beginner",
				calibrationSnippets: [
					"Pedro es un hombre. Pedro está en un jardín. Sol es un perro. Sol duerme junto a Pedro.",
				],
			},
		},
		seeds: [],
	},
];

export const DEFAULT_GENRE = genres[0];

export function isGenreId(value: unknown): value is GenreId {
	return genres.some((genre) => genre.id === value);
}

export function getGenre(id: GenreId): Genre {
	const genre = genres.find((candidate) => candidate.id === id);
	if (!genre) throw new Error(`Unknown language: ${id}`);
	return genre;
}
