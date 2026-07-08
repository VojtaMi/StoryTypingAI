import { readFile } from "node:fs/promises";
import {
	DEFAULT_LESSON_GENERATION_SELECTION,
	type LessonGenerationSelection,
} from "../src/lessons/lessonGeneration.ts";
import type { LessonLevel } from "../src/lessons/types.ts";

const LESSON_LEVELS: ReadonlySet<string> = new Set([
	"absolute-beginner",
	"beginner",
	"intermediate",
]);

export function lessonSelectionFromArgs(
	args: string[],
): LessonGenerationSelection {
	return {
		level: readLevel(args) ?? DEFAULT_LESSON_GENERATION_SELECTION.level,
		body: readList(args, "--body") ?? DEFAULT_LESSON_GENERATION_SELECTION.body,
		exercises:
			readList(args, "--exercises") ??
			DEFAULT_LESSON_GENERATION_SELECTION.exercises,
	} as LessonGenerationSelection;
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
		return await readFile("curriculum.md", "utf8");
	} catch (error) {
		if (isNodeError(error) && error.code === "ENOENT") return undefined;
		throw error;
	}
}

function readLevel(args: string[]): LessonLevel | undefined {
	const level = readArg(args, "--level");
	if (!level) return undefined;
	if (!LESSON_LEVELS.has(level)) {
		throw new Error(`Unsupported lesson level: ${level}`);
	}
	return level as LessonLevel;
}

function readList(args: string[], name: string): string[] | undefined {
	const value = readArg(args, name);
	if (!value) return undefined;
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}
