import { createElement } from "react";
import type { LessonResourcesBlock } from "../../types";
import type { LessonBodyBrickSpec } from "../contracts";
import { ResourcesBlock } from "./ResourcesBlock";

export type { LessonResourcesBlock } from "../../types";

/**
 * Closing links and notes, synthesized from `lesson.resources`. Not generatable:
 * a model has no way to know which external pages exist, and `LessonResource`'s
 * union makes a link without a URL a compile error rather than a dead anchor.
 */
export const resourcesBrick: LessonBodyBrickSpec<LessonResourcesBlock> = {
	example: {
		id: "resources",
		type: "resources",
		title: "Going further",
		resources: [
			{
				type: "link",
				title: "Esperanto course at lernu.net",
				url: "https://lernu.net/",
			},
			{
				type: "note",
				title: "Pronunciation",
				content: "Every letter is spoken. `estas` is es-tas, never es-tuz.",
			},
		],
	},
	render: (block) => createElement(ResourcesBlock, { block }),
	toBotContext: (block) =>
		block.resources
			.map((resource) =>
				resource.type === "link"
					? `${resource.title}: ${resource.url}`
					: `${resource.title}: ${resource.content}`,
			)
			.join("\n"),
};
