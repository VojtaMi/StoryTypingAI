import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	LESSON_GENERATABLE_BODY_BRICK_TYPES,
	LESSON_GENERATABLE_EXERCISE_BRICK_TYPES,
} from "../src/lessons/bricks/index.ts";
import {
	DEFAULT_LESSON_GENERATION_SELECTION,
	type LessonGenerationSelection,
} from "../src/lessons/lessonGeneration.ts";
import { LESSON_LEVEL_LABELS, type LessonLevel } from "../src/lessons/types.ts";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const LESSON_LEVELS = Object.keys(LESSON_LEVEL_LABELS) as LessonLevel[];

export function lessonSelectionFromArgs(
	args: string[],
): LessonGenerationSelection {
	return {
		level: readLevel(args) ?? DEFAULT_LESSON_GENERATION_SELECTION.level,
		body:
			readBrickList(args, "--body", LESSON_GENERATABLE_BODY_BRICK_TYPES) ??
			DEFAULT_LESSON_GENERATION_SELECTION.body,
		exercises:
			readBrickList(
				args,
				"--exercises",
				LESSON_GENERATABLE_EXERCISE_BRICK_TYPES,
			) ?? DEFAULT_LESSON_GENERATION_SELECTION.exercises,
	};
}

export function readArg(args: string[], name: string): string | undefined {
	const inline = args.find((arg) => arg.startsWith(`${name}=`));
	if (inline) return inline.slice(name.length + 1);

	const index = args.indexOf(name);
	if (index >= 0) return args[index + 1];

	return undefined;
}

export async function readCurriculumContext(): Promise<string | undefined> {
	try {
		return await readFile(resolve(MODULE_DIR, "../curriculum.md"), "utf8");
	} catch (error) {
		if (isNodeError(error) && error.code === "ENOENT") return undefined;
		throw error;
	}
}

function readLevel(args: string[]): LessonLevel | undefined {
	const level = readArg(args, "--level");
	if (!level) return undefined;
	if (!isOneOf(level, LESSON_LEVELS)) {
		throw new Error(
			`Unsupported lesson level: ${level}. Valid options: ${LESSON_LEVELS.join(", ")}`,
		);
	}
	return level;
}

function readList(args: string[], name: string): string[] | undefined {
	const value = readArg(args, name);
	if (!value) return undefined;
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function readBrickList<T extends string>(
	args: string[],
	name: string,
	validOptions: readonly T[],
): T[] | undefined {
	const values = readList(args, name);
	if (!values) return undefined;

	const valid: T[] = [];
	const invalid: string[] = [];
	for (const value of values) {
		if (isOneOf(value, validOptions)) valid.push(value);
		else invalid.push(value);
	}
	if (invalid.length > 0) {
		throw new Error(
			`Unsupported ${name} value: ${invalid.join(", ")}. Valid options: ${validOptions.join(", ")}`,
		);
	}
	return valid;
}

function isOneOf<T extends string>(
	value: string,
	validOptions: readonly T[],
): value is T {
	return validOptions.includes(value as T);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}
