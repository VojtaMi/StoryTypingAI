import { createElement } from "react";
import { isObject, requiredString } from "../../../structuredGeneration";
import type { LessonBodyBrickSpec } from "../contracts";
import { StoryBlock } from "./StoryBlock";

export interface LessonStoryBlock {
	id: string;
	type: "story";
	title: string;
	intro: string;
	text: string;
	sentences?: string[];
}

export const storyBrick: LessonBodyBrickSpec<LessonStoryBlock> = {
	example: {
		id: "story",
		type: "story",
		title: "Your story",
		intro: "Read it aloud, then type it from memory on the next screen.",
		text: "La kato estas en la domo. La domo estas varma.",
		sentences: ["La kato estas en la domo.", "La domo estas varma."],
	},
	generation: {
		shape: {
			sentences: [
				"Short Esperanto sentence using introduced words",
				"Another short Esperanto sentence",
			],
		},
		instructions:
			"Write a tiny two to five sentence Esperanto practice story. " +
			"Use mostly the introduced words and very basic known words. Do not include English in the story.",
		example: {
			sentences: ["La kato estas en la domo.", "La domo estas varma."],
		},
		parse(value) {
			if (
				!isObject(value) ||
				!Array.isArray(value.sentences) ||
				value.sentences.length < 2 ||
				value.sentences.length > 5
			) {
				throw new Error("Generated story needs two to five sentences.");
			}
			const sentences = value.sentences.map((sentence) =>
				requiredString(sentence, "story sentence"),
			);
			return {
				id: "story",
				type: "story",
				title: "Your story",
				intro: "Read it aloud, then type it from memory on the next screen.",
				text: sentences.join(" "),
				sentences,
			};
		},
	},
	render: (block, ctx) => createElement(StoryBlock, { block, ctx }),
	toBotContext: (block) => block.text,
};
