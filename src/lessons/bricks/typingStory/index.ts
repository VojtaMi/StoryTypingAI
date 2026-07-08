import { createElement } from "react";
import { lessonStoryText } from "../../lessonContent";
import type { TypingStoryLessonExercise } from "../../types";
import { type ExerciseBrickSpec, STORY_BODY_BRICK_TYPE } from "../contracts";
import LessonTypingExercise from "./LessonTypingExercise";

const DEFAULT_TYPING_IMAGE = "/images/lesson-typing-bg.webp";

export const typingStoryBrick: ExerciseBrickSpec<TypingStoryLessonExercise> = {
	example: {
		id: "typing",
		type: "typing-story",
	},
	generation: {
		requires: STORY_BODY_BRICK_TYPE,
		create() {
			return {
				id: "typing",
				type: "typing-story",
			};
		},
	},
	assertRenderable(_exercise, lesson) {
		if (!lessonStoryText(lesson)) {
			throw new Error(`Lesson ${lesson.id} types a story it does not have.`);
		}
	},
	render: (exercise, ctx) =>
		createElement(LessonTypingExercise, {
			lessonId: ctx.lessonId,
			text: lessonStoryText(ctx.lesson),
			imageUrl: exercise.imageUrl ?? DEFAULT_TYPING_IMAGE,
			imageAlt: ctx.lesson.storyImagePrompt,
			backgroundIntro: ctx.backgroundIntro,
			onComplete: ctx.onComplete,
			onBack: ctx.onBack,
		}),
	toBotContext: (_exercise, lesson) =>
		[`## Story typing`, lessonStoryText(lesson)].join("\n"),
};

export { default as LessonTypingExercise } from "./LessonTypingExercise";
