import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import {
	getLessonBricks,
	parseGeneratedLesson,
} from "../src/lessons/lessonGeneration.ts";
import { generatedLessons } from "../src/lessons/predefined/generatedLessons.ts";
import { lessons } from "../src/lessons/predefined/lessons.ts";
import type { Lesson } from "../src/lessons/types.ts";
import { slugify } from "../src/structuredGeneration.ts";
import { lessonSelectionFromArgs, readArg } from "./lesson-generation-cli.ts";

const GENERATED_LESSONS_PATH = "src/lessons/predefined/generatedLessons.ts";
const execFileAsync = promisify(execFile);

const args = process.argv.slice(2);
const selection = lessonSelectionFromArgs(args);
const inputPath = readArg(args, "--input");
const jsonText = inputPath
	? await readFile(inputPath, "utf8")
	: await readStdin();
const lesson = parseGeneratedLesson(
	jsonText,
	getLessonBricks(selection),
	(title) => `generated-${slugify(title, "lesson")}`,
);

await appendLesson(lesson);
console.log(JSON.stringify(lesson, null, 2));

async function readStdin(): Promise<string> {
	if (process.stdin.isTTY) {
		throw new Error(
			"Pass generated lesson JSON on stdin or with --input path/to/lesson.json.",
		);
	}
	let text = "";
	process.stdin.setEncoding("utf8");
	for await (const chunk of process.stdin) {
		text += chunk;
	}
	return text;
}

async function appendLesson(lesson: Lesson): Promise<void> {
	const generatedIds = new Set(generatedLessons.map((item) => item.id));
	if (generatedIds.has(lesson.id)) {
		throw new Error(
			`Generated lesson id already exists in ${GENERATED_LESSONS_PATH}: ${lesson.id}`,
		);
	}

	// `lessons` is predefined + generated, and generated ids already threw above.
	if (lessons.some((item) => item.id === lesson.id)) {
		throw new Error(
			`Generated lesson id conflicts with a predefined lesson: ${lesson.id}`,
		);
	}

	const allLessons = [...generatedLessons, lesson];
	await writeFile(
		GENERATED_LESSONS_PATH,
		[
			'import type { Lesson } from "../types";',
			"",
			`export const generatedLessons: Lesson[] = ${JSON.stringify(allLessons, null, "\t")};`,
			"",
		].join("\n"),
		"utf8",
	);
	await execFileAsync("npx", [
		"biome",
		"check",
		"--write",
		GENERATED_LESSONS_PATH,
	]);
}
