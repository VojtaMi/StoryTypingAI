import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import {
	getLessonBricks,
	parseGeneratedLesson,
} from "../src/lessons/lessonGeneration.ts";
import { authoredLessons } from "../src/lessons/predefined/authoredLessons.ts";
import { lessons } from "../src/lessons/predefined/lessons.ts";
import type { Lesson } from "../src/lessons/types.ts";
import { slugify } from "../src/structuredGeneration.ts";
import { lessonSelectionFromArgs, readArg } from "./lesson-generation-cli.ts";

const AUTHORED_LESSONS_PATH = "src/lessons/predefined/authoredLessons.ts";
const FILE_HEADER = [
	'import type { Lesson } from "../types";',
	"",
	"/**",
	" * Curriculum lessons authored with AI help via `npm run lesson:generation:append`.",
	" * They are ordinary predefined lessons — the script only automates writing them",
	" * down. Lessons the app generates for a learner at runtime never land here.",
	" */",
];
const execFileAsync = promisify(execFile);

const args = process.argv.slice(2);
const selection = lessonSelectionFromArgs(args);
const inputPath = readArg(args, "--input");
const explicitId = readArg(args, "--id");
const jsonText = inputPath
	? await readFile(inputPath, "utf8")
	: await readStdin();
const lesson = parseGeneratedLesson(
	jsonText,
	getLessonBricks(selection),
	(title) => explicitId ?? slugify(title, "lesson"),
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
	// `lessons` already contains the authored ones, so this covers both sources.
	if (lessons.some((item) => item.id === lesson.id)) {
		throw new Error(
			`A lesson with id "${lesson.id}" already exists. ` +
				"Give the lesson a different title, or pass --id <slug> to disambiguate.",
		);
	}

	const allLessons = [...authoredLessons, lesson];
	await writeFile(
		AUTHORED_LESSONS_PATH,
		[
			...FILE_HEADER,
			`export const authoredLessons: Lesson[] = ${JSON.stringify(allLessons, null, "\t")};`,
			"",
		].join("\n"),
		"utf8",
	);
	await execFileAsync("npx", [
		"biome",
		"check",
		"--write",
		AUTHORED_LESSONS_PATH,
	]);
}
