import {
	buildLessonPromptFromBricks,
	getLessonBricks,
} from "../src/lessons/lessonGeneration.ts";
import {
	lessonSelectionFromArgs,
	readArg,
	readCurriculumContext,
} from "./lesson-generation-cli.ts";

const args = process.argv.slice(2);
const selection = lessonSelectionFromArgs(args);
const bricks = getLessonBricks(selection);
const goal = readArg(args, "--goal");
const curriculum = await readCurriculumContext();

console.log(
	JSON.stringify(
		{
			selection,
			goal,
			curriculum,
			bricks,
			prompt: buildLessonPromptFromBricks(bricks),
		},
		null,
		2,
	),
);
