import assert from "node:assert/strict";
import {
	buildLessonPrompt,
	DEFAULT_LESSON_GENERATION_SELECTION,
	getLessonBricks,
	parseGeneratedLesson,
} from "../src/lessons/lessonGeneration.ts";
import { slugify } from "../src/structuredGeneration.ts";

const sampleResponse = JSON.stringify({
	title: "Kato en domo",
	lede: "Practice a tiny home scene with three useful words.",
	body: [
		{
			words: [
				{
					term: "kato",
					meaning: "cat",
					partOfSpeech: "noun",
					example: "Kato estas en domo.",
				},
				{
					term: "domo",
					meaning: "house",
					partOfSpeech: "noun",
					example: "Domo estas granda.",
				},
				{
					term: "en",
					meaning: "in",
					partOfSpeech: "preposition",
					example: "Kato estas en domo.",
				},
			],
		},
		{
			title: "Using en",
			explanation: "`en` means in. It shows where something is.",
			examples: ["Kato estas en domo."],
		},
	],
});

const bricks = getLessonBricks(DEFAULT_LESSON_GENERATION_SELECTION);
const lesson = parseGeneratedLesson(sampleResponse, bricks, (title) =>
	slugify(title, "lesson"),
);

const tipResponse = JSON.stringify({
	title: "Kato en domo",
	lede: "Practice a tiny home scene with one practical reminder.",
	body: [
		{
			words: [
				{
					term: "kato",
					meaning: "cat",
					partOfSpeech: "noun",
					example: "Kato estas en domo.",
				},
				{
					term: "domo",
					meaning: "house",
					partOfSpeech: "noun",
					example: "Domo estas granda.",
				},
				{
					term: "en",
					meaning: "in",
					partOfSpeech: "preposition",
					example: "Kato estas en domo.",
				},
			],
		},
		{
			title: "Using en",
			explanation: "`en` means in. It shows where something is.",
			examples: ["Kato estas en domo."],
		},
		{
			title: "Pronunciation tip",
			body: [
				"Say every written letter, and stress the second-to-last syllable.",
			],
		},
		{
			sentences: ["Kato estas en domo.", "Domo estas granda."],
		},
	],
});

const tipBricks = getLessonBricks({
	...DEFAULT_LESSON_GENERATION_SELECTION,
	body: ["vocabulary", "grammar", "tip", "story"],
});
const lessonWithTip = parseGeneratedLesson(tipResponse, tipBricks, (title) =>
	slugify(title, "lesson"),
);
assert.deepStrictEqual(lessonWithTip.teachingSections, [
	{
		id: "tip",
		type: "tip",
		title: "Pronunciation tip",
		body: ["Say every written letter, and stress the second-to-last syllable."],
	},
]);

console.log(buildLessonPrompt(bricks));
console.log(JSON.stringify(lesson, null, 2));
