import { createElement } from "react";
import {
	isObject,
	requiredString,
	splitOnWord,
} from "../../../structuredGeneration";
import type { IntroducedWord, LessonVocabularyBlock } from "../../types";
import type { LessonBodyBrickSpec } from "../contracts";
import { VocabularyBlock } from "./VocabularyBlock";

export type { LessonVocabularyBlock } from "../../types";

/**
 * A vocabulary example is a cloze: it contains its term as a whole token, and
 * at least one other word to give that term context. Throws otherwise.
 *
 * The vocabulary brick owns this property because it owns the shape of
 * `IntroducedWord.example`. Two callers depend on it — this brick renders the
 * term emphasized inside its sentence, and `fill-blank` blanks the term out to
 * make an exercise. Neither can hold if `example` is `"Mi."`.
 */
export function clozeFor(word: IntroducedWord): {
	before: string;
	match: string;
	after: string;
} {
	const cloze = splitOnWord(
		word.example,
		word.term,
		`Vocabulary example "${word.example}" does not contain the term "${word.term}".`,
	);
	const context = `${cloze.before}${cloze.after}`;
	if (!/\p{L}/u.test(context)) {
		throw new Error(
			`Vocabulary example "${word.example}" is just the term "${word.term}"; it needs at least one other word.`,
		);
	}
	return cloze;
}

export const vocabularyBrick: LessonBodyBrickSpec<LessonVocabularyBlock> = {
	weight: "light",
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
			"Use target words when provided. Each example must be simple Esperanto that a learner at this level can understand, " +
			"and must be a complete sentence containing the term plus at least one other word — the app blanks the term out of it to build an exercise. " +
			"Give every word a distinct English meaning.",
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
			const words = value.words.map((word) => {
				if (!isObject(word)) {
					throw new Error("Generated vocabulary word is invalid.");
				}
				const parsed = {
					term: requiredString(word.term, "vocabulary term"),
					meaning: requiredString(word.meaning, "vocabulary meaning"),
					partOfSpeech: requiredString(
						word.partOfSpeech,
						"vocabulary part of speech",
					),
					example: requiredString(word.example, "vocabulary example"),
				};
				clozeFor(parsed);
				return parsed;
			});
			const meanings = new Set(words.map((word) => word.meaning));
			if (meanings.size !== words.length) {
				throw new Error("Generated vocabulary reuses an English meaning.");
			}
			return {
				id: "vocabulary",
				type: "vocabulary",
				title: "New words",
				words,
			};
		},
	},
	render: (block, ctx) => createElement(VocabularyBlock, { block, ctx }),
	toBotContext: (block) =>
		block.words
			.map(
				(word) =>
					`${word.term} (${word.partOfSpeech}) — ${word.meaning}. Example: ${word.example}`,
			)
			.join("\n"),
};
