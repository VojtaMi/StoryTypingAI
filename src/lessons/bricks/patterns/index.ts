import { createElement } from "react";
import type { LessonPattern, LessonPatternsBlock } from "../../types";
import type { LessonBodyBrickSpec } from "../contracts";
import { PatternsBlock } from "./PatternsBlock";

export type { LessonPatternsBlock } from "../../types";

/** The slot skeleton, which is what a pattern *is*. Its title is optional prose. */
export function patternShape(pattern: LessonPattern): string {
	return pattern.slots.join(" + ");
}

export const patternsBrick: LessonBodyBrickSpec<LessonPatternsBlock> = {
	weight: "light",
	example: {
		id: "patterns",
		type: "patterns",
		title: "Patterns",
		patterns: [
			{
				id: "subject-estas-place",
				slots: ["subject", "estas", "place"],
				examples: ["La kato estas en la domo."],
			},
		],
	},
	render: (block) => createElement(PatternsBlock, { block }),
	toBotContext: (block) =>
		block.patterns
			.map((pattern) =>
				[
					pattern.title
						? `${pattern.title}: ${patternShape(pattern)}`
						: patternShape(pattern),
					`Examples: ${pattern.examples.join("; ")}`,
				].join(". "),
			)
			.join("\n"),
};
