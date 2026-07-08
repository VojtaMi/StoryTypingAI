import type { ReactNode } from "react";
import { exerciseOfType, renderExerciseBrick } from "./bricks";
import { WordMatchExercise } from "./bricks/wordMatch";
import { buildLessonBotContext } from "./lessonBotContext";
import { completeLessonStage } from "./lessonProgress";
import EsperantoIntro from "./predefined/EsperantoIntro";
import KeyboardIntroExercise from "./predefined/keyboard/KeyboardIntroExercise";
import KeyboardWordsExercise from "./predefined/keyboard/KeyboardWordsExercise";
import { KEYBOARD_PRACTICE_WORDS } from "./predefined/keyboard/keyboardPracticeWords";
import {
	firstLesson,
	gardenLesson,
	miEstasHomoLesson,
} from "./predefined/lessons";
import LessonIntro from "./templates/LessonIntro";
import type { Lesson, LessonExercise } from "./types";

/** What a step's renderer receives: the two curriculum-level hooks it can fire. */
export interface StepRenderCtx {
	/** Advance the curriculum (records this step's stage, then moves to the next step or finishes). */
	onComplete: () => void;
	/** Leave the flow back to the lessons menu. */
	onExit: () => void;
}

/**
 * One position in the linear course. The curriculum used to live as a hardcoded
 * state machine in App.tsx (a route + a `View` case + a completion handler per
 * step); it is now this ordered data array. Order *is* the "what's next" logic.
 */
export interface CurriculumStep {
	path: string;
	/** Progress stage recorded when the learner completes this step (intro/practice steps that record nothing omit it). */
	stageId?: string;
	/** The last step leaves the curriculum (into the story) instead of advancing. */
	isFinal?: boolean;
	/** For the final step: the path its recorded stage points `lastPath` at. */
	finalStagePath?: string;
	render(ctx: StepRenderCtx): ReactNode;
}

/** Renders a lesson's exercise (by type) as a full step through the interactive brick registry. */
function renderExerciseStep(
	lesson: Lesson,
	type: LessonExercise["type"],
	ctx: StepRenderCtx,
): ReactNode {
	return renderExerciseBrick(exerciseOfType(lesson, type), {
		lesson,
		lessonId: lesson.id,
		backgroundIntro: buildLessonBotContext(lesson),
		onComplete: ctx.onComplete,
		onBack: ctx.onExit,
	});
}

export const CURRICULUM: CurriculumStep[] = [
	{
		path: "/lessons/intro",
		stageId: "intro",
		render: (ctx) => (
			<EsperantoIntro onStart={ctx.onComplete} onBack={ctx.onExit} />
		),
	},
	{
		path: "/lessons/hundo-estas-besto",
		render: (ctx) => <LessonIntroStep lesson={firstLesson} ctx={ctx} />,
	},
	{
		path: "/lessons/hundo-estas-besto/word-match",
		stageId: "hundo-estas-besto.word-match",
		render: (ctx) => renderExerciseStep(firstLesson, "word-match", ctx),
	},
	{
		path: "/lessons/hundo-estas-besto/typing",
		stageId: "hundo-estas-besto.typing",
		render: (ctx) => renderExerciseStep(firstLesson, "typing-story", ctx),
	},
	{
		path: "/lessons/esperanto-keyboard",
		stageId: "esperanto-keyboard.chars",
		render: (ctx) => (
			<KeyboardIntroExercise onComplete={ctx.onComplete} onBack={ctx.onExit} />
		),
	},
	{
		path: "/lessons/esperanto-keyboard/words",
		stageId: "esperanto-keyboard.words",
		render: (ctx) => (
			<KeyboardWordsExercise onComplete={ctx.onComplete} onBack={ctx.onExit} />
		),
	},
	{
		path: "/lessons/esperanto-keyboard/word-match",
		stageId: "esperanto-keyboard",
		render: (ctx) => (
			<WordMatchExercise
				words={KEYBOARD_PRACTICE_WORDS}
				completeLabel="Continue →"
				onComplete={ctx.onComplete}
				onBack={ctx.onExit}
			/>
		),
	},
	{
		path: "/lessons/nia-gardeno",
		render: (ctx) => <LessonIntroStep lesson={gardenLesson} ctx={ctx} />,
	},
	{
		path: "/lessons/nia-gardeno/word-match",
		stageId: "nia-gardeno.word-match",
		render: (ctx) => renderExerciseStep(gardenLesson, "word-match", ctx),
	},
	{
		path: "/lessons/nia-gardeno/phrase-builder",
		stageId: "nia-gardeno.phrase-builder",
		render: (ctx) => renderExerciseStep(gardenLesson, "phrase-builder", ctx),
	},
	{
		path: "/lessons/nia-gardeno/typing",
		stageId: "nia-gardeno.typing",
		render: (ctx) => renderExerciseStep(gardenLesson, "typing-story", ctx),
	},
	{
		path: "/lessons/mi-estas-homo",
		render: (ctx) => <LessonIntroStep lesson={miEstasHomoLesson} ctx={ctx} />,
	},
	{
		path: "/lessons/mi-estas-homo/word-match",
		stageId: "mi-estas-homo.word-match",
		render: (ctx) => renderExerciseStep(miEstasHomoLesson, "word-match", ctx),
	},
	{
		path: "/lessons/mi-estas-homo/typing",
		stageId: "mi-estas-homo.typing",
		isFinal: true,
		finalStagePath: "/lessons/mi-estas-homo",
		render: (ctx) => renderExerciseStep(miEstasHomoLesson, "typing-story", ctx),
	},
];

function LessonIntroStep({
	lesson,
	ctx,
}: {
	lesson: Lesson;
	ctx: StepRenderCtx;
}) {
	return (
		<LessonIntro
			lesson={lesson}
			onBeginPractice={() => ctx.onComplete()}
			onBack={ctx.onExit}
		/>
	);
}

export const CURRICULUM_PATHS: ReadonlySet<string> = new Set(
	CURRICULUM.map((step) => step.path),
);

/** The learner's entry point when they have no resumable progress. */
export const FIRST_STEP_PATH = CURRICULUM[0].path;

/** Resolves the numbered deep-link aliases (`/lessons/3`) to their real step path. */
export function canonicalCurriculumPath(pathname: string): string {
	const match = /^\/lessons\/(\d+)$/.exec(pathname);
	if (match) {
		const index = Number(match[1]);
		if (index >= 0 && index < CURRICULUM.length) {
			return CURRICULUM[index].path;
		}
	}
	return pathname;
}

/**
 * Renders the active curriculum step and owns advancement: on completion it
 * records the step's stage and either moves to the next step or finishes.
 */
export function CurriculumView({
	path,
	onNavigate,
	onExit,
	onFinish,
}: {
	path: string;
	onNavigate: (path: string) => void;
	onExit: () => void;
	onFinish: () => void;
}): ReactNode {
	const index = CURRICULUM.findIndex((step) => step.path === path);
	if (index < 0) return null;
	const step = CURRICULUM[index];

	const onComplete = () => {
		const next = CURRICULUM[index + 1];
		if (step.isFinal || !next) {
			if (step.stageId) {
				completeLessonStage(step.stageId, step.finalStagePath ?? step.path);
			}
			onFinish();
			return;
		}
		if (step.stageId) {
			completeLessonStage(step.stageId, next.path);
		}
		onNavigate(next.path);
	};

	return step.render({ onComplete, onExit });
}
