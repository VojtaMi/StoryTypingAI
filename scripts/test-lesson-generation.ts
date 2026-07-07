import {
	buildLessonPrompt,
	DEFAULT_LESSON_GENERATION_SELECTION,
	parseGeneratedLesson,
} from "../src/lessons/lessonGeneration.ts";

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
		{
			sentences: ["Kato estas en domo.", "Domo estas granda."],
		},
	],
	exercises: [{}, {}],
});

const lesson = parseGeneratedLesson(
	sampleResponse,
	DEFAULT_LESSON_GENERATION_SELECTION,
);

console.log(buildLessonPrompt(DEFAULT_LESSON_GENERATION_SELECTION));
console.log(JSON.stringify(lesson, null, 2));
