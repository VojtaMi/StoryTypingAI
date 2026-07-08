import { createElement } from "react";
import { isObject, requiredString } from "../../../structuredGeneration";
import type { IntroducedWord } from "../../types";
import type { LessonBodyBrickSpec } from "../contracts";
import { VocabularyBlock } from "./VocabularyBlock";

export interface LessonVocabularyBlock {
	id: string;
	type: "vocabulary";
	title: string;
	words: IntroducedWord[];
}

export const vocabularyBrick: LessonBodyBrickSpec<LessonVocabularyBlock> = {
	example: {
		id: "vocabulary",
		type: "vocabulary",
		title: "New words",
		words: [
			{
				term: "kato",
				meaning: "cat",
				partOfSpeech: "noun",
				example: "La kato estas en la domo.",
			},
			{
				term: "domo",
				meaning: "house",
				partOfSpeech: "noun",
				example: "La domo estas granda.",
			},
			{
				term: "en",
				meaning: "in",
				partOfSpeech: "preposition",
				example: "La kato estas en la domo.",
			},
		],
	},
	generation: {
		shape: {
			words: [
				{
					term: "Esperanto word",
					meaning: "English meaning",
					partOfSpeech: "noun | verb | adjective | adverb | pronoun | phrase",
					example: "Short Esperanto example using the word",
				},
			],
		},
		instructions:
			"Introduce three to six canonical vocabulary items for the lesson. " +
			"Use target words when provided. Each example must be simple Esperanto that a learner at this level can understand.",
		example: {
			words: [
				{
					term: "kato",
					meaning: "cat",
					partOfSpeech: "noun",
					example: "La kato estas en la domo.",
				},
				{
					term: "domo",
					meaning: "house",
					partOfSpeech: "noun",
					example: "La domo estas granda.",
				},
				{
					term: "en",
					meaning: "in",
					partOfSpeech: "preposition",
					example: "La kato estas en la domo.",
				},
			],
		},
		parse(value) {
			if (
				!isObject(value) ||
				!Array.isArray(value.words) ||
				value.words.length < 3 ||
				value.words.length > 6
			) {
				throw new Error("Generated vocabulary needs three to six words.");
			}
			return {
				id: "vocabulary",
				type: "vocabulary",
				title: "New words",
				words: value.words.map((word) => {
					if (!isObject(word)) {
						throw new Error("Generated vocabulary word is invalid.");
					}
					return {
						term: requiredString(word.term, "vocabulary term"),
						meaning: requiredString(word.meaning, "vocabulary meaning"),
						partOfSpeech: requiredString(
							word.partOfSpeech,
							"vocabulary part of speech",
						),
						example: requiredString(word.example, "vocabulary example"),
					};
				}),
			};
		},
	},
	render: (block, ctx) => createElement(VocabularyBlock, { block, ctx }),
	toBotContext: (block) =>
		block.words
			.map((word) => `${word.term} (${word.partOfSpeech}) — ${word.meaning}`)
			.join("\n"),
};
