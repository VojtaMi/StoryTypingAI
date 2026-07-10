import { createElement } from "react";
import { isObject, requiredString } from "../../../structuredGeneration";
import type { LessonStoryBlock } from "../../types";
import type { LessonBodyBrickSpec } from "../contracts";
import { StoryBlock, storyBlockText } from "./StoryBlock";

export type { LessonStoryBlock } from "../../types";

export const storyBrick: LessonBodyBrickSpec<LessonStoryBlock> = {
	weight: "light",
	example: {
		id: "story",
		type: "story",
		title: "Sentences",
		intro: "Listen and repeat subsequent sentences.",
		sentences: ["La kato estas en la domo."],
	},
	generation: {
		shape: {
			sentences: [
				"Short Esperanto sentence using introduced words",
				"Another short Esperanto sentence",
			],
		},
		instructions:
			"Write one to five short Esperanto practice sentences. " +
			"Use mostly the introduced words and very basic known words. Do not include English.",
		example: {
			sentences: ["La kato estas en la domo."],
		},
		parse(value) {
			if (
				!isObject(value) ||
				!Array.isArray(value.sentences) ||
				value.sentences.length < 1 ||
				value.sentences.length > 5
			) {
				throw new Error("Generated sentences need one to five sentences.");
			}
			const sentences = value.sentences.map((sentence) =>
				requiredString(sentence, "story sentence"),
			);
			return {
				id: "story",
				type: "story",
				title: "Sentences",
				intro: "Listen and repeat subsequent sentences.",
				sentences,
			};
		},
	},
	render: (block, ctx) => createElement(StoryBlock, { block, ctx }),
	toBotContext: (block) => storyBlockText(block),
};
