import { isObject, requiredString } from "../../../structuredGeneration";
import type { LessonTeachingSection } from "../../types";
import type { LessonBodyBrickSpec } from "../contracts";
import {
	describeTeachingSection,
	renderTeachingSection,
} from "./TeachingBrick";

export {
	describeTeachingSection,
	renderTeachingSection,
} from "./TeachingBrick";

export const teachingBrick: LessonBodyBrickSpec<LessonTeachingSection> = {
	weight: "light",
	example: {
		id: "teaching",
		type: "overview",
		title: "A cat at home",
		body: [
			"This lesson uses a tiny home scene to practice saying where something is.",
		],
	},
	generation: {
		shape: {
			title: "Teaching point title",
			body: [
				"Plain-English explanation paragraph",
				"Optional second paragraph",
			],
		},
		instructions:
			"Give a short learner-facing overview of the lesson theme, context, or communication goal. " +
			"Use one or two short English paragraphs. Do not introduce a second standalone grammar rule; leave grammar mechanics to the grammar brick.",
		example: {
			title: "A cat at home",
			body: [
				"This lesson uses a tiny home scene to practice saying where something is.",
			],
		},
		parse(value) {
			if (
				!isObject(value) ||
				!Array.isArray(value.body) ||
				value.body.length < 1 ||
				value.body.length > 2
			) {
				throw new Error(
					"Generated teaching overview needs one or two paragraphs.",
				);
			}
			return {
				id: "teaching",
				type: "overview",
				title: requiredString(value.title, "teaching title"),
				body: value.body.map((paragraph) =>
					requiredString(paragraph, "teaching paragraph"),
				),
			};
		},
	},
	render: (block) => renderTeachingSection(block),
	toBotContext: (block) => describeTeachingSection(block),
};
