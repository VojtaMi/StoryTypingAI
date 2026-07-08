import assert from "node:assert/strict";
import { exerciseBrickEntries } from "../src/lessons/bricks/exerciseBricks.tsx";
import {
	type LessonBodyBlock,
	lessonBodyBrickEntries,
} from "../src/lessons/bricks/lessonBodyBricks.tsx";

type BrickSpec = {
	example?: unknown;
	generation?: unknown;
};

type ParseableGeneration = {
	example?: unknown;
	parse(value: unknown): unknown;
};

type DerivableGeneration = {
	create(): unknown;
};

const bodyBrickTypes = new Set(
	lessonBodyBrickEntries().map(([type]) => type as LessonBodyBlock["type"]),
);

for (const [type, spec] of lessonBodyBrickEntries()) {
	checkBrick(`body:${type}`, spec);
}

for (const [type, spec] of exerciseBrickEntries()) {
	checkBrick(`exercise:${type}`, spec);
	if (spec.generation) {
		assert.ok(
			bodyBrickTypes.has(spec.generation.requires),
			`Exercise brick "${type}" requires unknown body brick "${spec.generation.requires}".`,
		);
	}
}

function checkBrick(name: string, spec: BrickSpec) {
	assert.notStrictEqual(spec.example, undefined, `${name} is missing example.`);

	if (hasParse(spec.generation)) {
		assert.notStrictEqual(
			spec.generation.example,
			undefined,
			`${name} generation is missing example.`,
		);
		assert.deepStrictEqual(
			spec.generation.parse(spec.generation.example),
			spec.example,
			`${name} generation example does not parse to the brick example.`,
		);
	}

	// A derived exercise's example must be exactly what the app builds, or the
	// gallery would show content no lesson ever contains.
	if (hasCreate(spec.generation)) {
		assert.deepStrictEqual(
			spec.generation.create(),
			spec.example,
			`${name} example does not match what its create() derives.`,
		);
	}

	console.log(`checked ${name}`);
}

function hasParse(generation: unknown): generation is ParseableGeneration {
	if (typeof generation !== "object" || generation === null) return false;
	const candidate = generation as { parse?: unknown };
	return typeof candidate.parse === "function";
}

function hasCreate(generation: unknown): generation is DerivableGeneration {
	if (typeof generation !== "object" || generation === null) return false;
	const candidate = generation as { create?: unknown };
	return typeof candidate.create === "function";
}
