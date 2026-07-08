import { createElement } from "react";
import {
	isObject,
	requiredString,
	slugify,
} from "../../../structuredGeneration";
import type { LessonGrammarBlock } from "../../types";
import type { LessonBodyBrickSpec } from "../contracts";
import { GrammarBlock } from "./GrammarBlock";

export type { LessonGrammarBlock } from "../../types";

export const grammarBrick: LessonBodyBrickSpec<LessonGrammarBlock> = {
	example: {
		id: "grammar",
		type: "grammar",
		title: "Grammar",
		concepts: [
			{
				id: "using-en",
				title: "Using en",
				explanation: "`En` means in. It shows where something is.",
				examples: ["La kato estas en la domo."],
			},
		],
	},
	generation: {
		shape: {
			title: "Grammar point title",
			explanation: "Plain-English explanation",
			examples: ["Short Esperanto example"],
		},
		instructions:
			"Teach one compact grammar or usage point that helps with the introduced words and story. " +
			"Use one short English explanation. Include one to three short Esperanto examples. Put Esperanto forms in backticks when naming them.",
		example: {
			title: "Using en",
			explanation: "`En` means in. It shows where something is.",
			examples: ["La kato estas en la domo."],
		},
		parse(value) {
			if (
				!isObject(value) ||
				!Array.isArray(value.examples) ||
				value.examples.length < 1 ||
				value.examples.length > 3
			) {
				throw new Error("Generated grammar needs one to three examples.");
			}
			const title = requiredString(value.title, "grammar title");
			return {
				id: "grammar",
				type: "grammar",
				title: "Grammar",
				concepts: [
					{
						id: slugify(title, "grammar"),
						title,
						explanation: requiredString(
							value.explanation,
							"grammar explanation",
						),
						examples: value.examples.map((example) =>
							requiredString(example, "grammar example"),
						),
					},
				],
			};
		},
	},
	render: (block) => createElement(GrammarBlock, { block }),
	toBotContext: (block) =>
		block.concepts
			.map((concept) =>
				[
					`${concept.title}: ${concept.explanation}`,
					concept.examples.length > 0
						? `Examples: ${concept.examples.join("; ")}`
						: undefined,
				]
					.filter(Boolean)
					.join("\n"),
			)
			.join("\n"),
};
