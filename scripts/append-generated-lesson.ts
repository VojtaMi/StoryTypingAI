import { readFile, writeFile } from "node:fs/promises";
import {
	getLessonBricks,
	parseGeneratedLessonFromBricks,
} from "../src/lessons/lessonGeneration.ts";
import { lessonSelectionFromArgs, readArg } from "./lesson-generation-cli.ts";

const GENERATED_LESSONS_PATH = "src/lessons/predefined/generatedLessons.ts";

const args = process.argv.slice(2);
const selection = lessonSelectionFromArgs(args);
const inputPath = readArg(args, "--input");
const jsonText = inputPath
	? await readFile(inputPath, "utf8")
	: await readStdin();
const lesson = parseGeneratedLessonFromBricks(
	jsonText,
	getLessonBricks(selection),
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

async function appendLesson(lesson: unknown): Promise<void> {
	const content = await readFile(GENERATED_LESSONS_PATH, "utf8");
	const lessonLiteral = indent(JSON.stringify(lesson, null, "\t"), "\t");

	if (/export const generatedLessons: Lesson\[\] = \[\s*\];/.test(content)) {
		await writeFile(
			GENERATED_LESSONS_PATH,
			content.replace(
				/export const generatedLessons: Lesson\[\] = \[\s*\];/,
				`export const generatedLessons: Lesson[] = [\n${lessonLiteral}\n];`,
			),
			"utf8",
		);
		return;
	}

	const marker = "\n];";
	const markerIndex = content.lastIndexOf(marker);
	if (markerIndex < 0) {
		throw new Error(`${GENERATED_LESSONS_PATH} has an unexpected shape.`);
	}

	const nextContent = `${content.slice(0, markerIndex)},\n${lessonLiteral}${content.slice(markerIndex)}`;
	await writeFile(GENERATED_LESSONS_PATH, nextContent, "utf8");
}

function indent(value: string, prefix: string): string {
	return value
		.split("\n")
		.map((line) => `${prefix}${line}`)
		.join("\n");
}
