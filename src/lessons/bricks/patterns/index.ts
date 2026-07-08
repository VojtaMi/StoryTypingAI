import { createElement } from "react";
import type { LessonPattern } from "../../types";
import type { LessonBodyBrickSpec } from "../contracts";
import { PatternsBlock } from "./PatternsBlock";

export interface LessonPatternsBlock {
	id: string;
	type: "patterns";
	title: string;
	patterns: LessonPattern[];
}

export const patternsBrick: LessonBodyBrickSpec<LessonPatternsBlock> = {
	example: {
		id: "patterns",
		type: "patterns",
		title: "Patterns",
		patterns: [
			{
				id: "subject-estas-place",
				title: "Subject + estas + place",
				slots: ["subject", "estas", "place"],
				examples: ["La kato estas en la domo."],
			},
		],
	},
	render: (block) => createElement(PatternsBlock, { block }),
	toBotContext: (block) =>
		block.patterns
			.map(
				(pattern) =>
					`${pattern.title}: ${pattern.slots.join(" + ")}. Examples: ${pattern.examples.join("; ")}`,
			)
			.join("\n"),
};
