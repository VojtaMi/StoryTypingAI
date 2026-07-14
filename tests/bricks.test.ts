import assert from "node:assert/strict";
import {
	exerciseBrickEntries,
	LESSON_GENERATABLE_BODY_BRICK_TYPES,
	LESSON_GENERATABLE_EXERCISE_BRICK_TYPES,
	type LessonBodyBlock,
	lessonBodyBrickEntries,
} from "../src/lessons/bricks/index.ts";

type BrickSpec = {
	example?: unknown;
	generation?: unknown;
	weight?: unknown;
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

// contracts.ts cannot import the registry, so the generatable list is written by
// hand. Pin it: every listed type must be a registry key whose brick can author.
const bodyBricksByType = new Map(lessonBodyBrickEntries());
for (const type of LESSON_GENERATABLE_BODY_BRICK_TYPES) {
	const spec = bodyBricksByType.get(type);
	assert.ok(spec, `Generatable body brick "${type}" is not a registry key.`);
	assert.ok(
		hasParse(spec.generation),
		`Body brick "${type}" is listed as generatable but has no generation.parse.`,
	);
	console.log(`checked generatable body:${type}`);
}

const exerciseBricksByType = new Map(exerciseBrickEntries());
for (const type of LESSON_GENERATABLE_EXERCISE_BRICK_TYPES) {
	const spec = exerciseBricksByType.get(type);
	assert.ok(
		spec,
		`Generatable exercise brick "${type}" is not a registry key.`,
	);
	assert.ok(
		hasCreate(spec.generation),
		`Exercise brick "${type}" is listed as generatable but has no generation.create.`,
	);
	console.log(`checked generatable exercise:${type}`);
}

function checkBrick(name: string, spec: BrickSpec) {
	assert.notStrictEqual(spec.example, undefined, `${name} is missing example.`);
	assert.ok(
		spec.weight === "light" || spec.weight === "heavy",
		`${name} has invalid weight "${String(spec.weight)}".`,
	);

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
