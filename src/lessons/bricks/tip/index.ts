import { createElement } from "react";
import { isObject, requiredString } from "../../../structuredGeneration";
import type { LessonTipBlock } from "../../types";
import type { LessonBodyBrickSpec } from "../contracts";
import { TipBlock } from "./TipBlock";

export type { LessonTipBlock } from "../../types";

export const tipBrick: LessonBodyBrickSpec<LessonTipBlock> = {
	example: {
		id: "tip",
		type: "tip",
		title: "Pronunciation tip",
		body: [
			"Every letter in Esperanto is always pronounced. The stress falls on the second-to-last syllable.",
		],
	},
	generation: {
		shape: {
			title: "Short tip title",
			body: ["One short learner-facing tip paragraph"],
		},
		instructions:
			"Write a short learner-facing tip that clarifies pronunciation, grammar, usage, memory, or learning strategy for this lesson. " +
			"Use one or two concise English paragraphs. Avoid unrelated trivia.",
		example: {
			title: "Pronunciation tip",
			body: [
				"Every letter in Esperanto is always pronounced. The stress falls on the second-to-last syllable.",
			],
		},
		parse(value) {
			if (
				!isObject(value) ||
				!Array.isArray(value.body) ||
				value.body.length < 1 ||
				value.body.length > 2
			) {
				throw new Error("Generated tip needs one or two paragraphs.");
			}
			return {
				id: "tip",
				type: "tip",
				title: requiredString(value.title, "tip title"),
				body: value.body.map((paragraph) =>
					requiredString(paragraph, "tip paragraph"),
				),
			};
		},
	},
	render: (block) => createElement(TipBlock, { block }),
	toBotContext: (block) => block.body.join("\n"),
};
