import { useCallback, useEffect, useState } from "react";
import ExerciseScreen from "./exercise_screen/ExerciseScreen";
import MainMenu from "./home_menu/MainMenu";
import {
	CURRICULUM,
	CURRICULUM_PATHS,
	CurriculumView,
	canonicalCurriculumPath,
	FIRST_STEP_PATH,
} from "./lessons/curriculum";
import LessonsMenu from "./lessons/LessonsMenu";
import {
	readLessonProgress,
	rememberLessonPath,
} from "./lessons/lessonProgress";
import {
	firstLesson,
	gardenLesson,
	miEstasHomoLesson,
} from "./lessons/predefined/lessons";
import {
	readSelectedTextModel,
	saveSelectedTextModel,
} from "./modelSelection/modelSelectionStore";
import type { TextModelId } from "./models";
import {
	deleteSavedStory,
	listSavedStories,
	type SavedStorySummary,
} from "./saves";
import {
	backgroundLayerStyle,
	useBackgroundLayers,
} from "./story_session/background";
import { useStorySession } from "./story_session/useStorySession";

const MAIN_MENU_PATH = "/";
const LESSONS_MENU_PATH = "/lessons";

const LESSON_MENU_ITEMS = [
	{
		id: "intro",
		title: "Intro",
		description: "Meet the course and the tiny-story format.",
		path: "/lessons/intro",
		completedStageIds: ["intro"],
	},
	{
		id: "hundo-estas-besto",
		title: firstLesson.title,
		description: "Learn hundo, estas, and besto through your first sentence.",
		path: "/lessons/hundo-estas-besto",
		completedStageIds: [
			"hundo-estas-besto.word-match",
			"hundo-estas-besto.typing",
		],
	},
	{
		id: "keyboard",
		title: "Keyboard",
		description: "Practise Esperanto characters, then type beginner words.",
		path: "/lessons/esperanto-keyboard",
		completedStageIds: ["esperanto-keyboard"],
	},
	{
		id: "nia-gardeno",
		title: gardenLesson.title,
		description:
			"Combine colors, ownership, and known nouns into a tiny scene.",
		path: "/lessons/nia-gardeno",
		completedStageIds: ["nia-gardeno.typing"],
	},
	{
		id: "mi-estas-homo",
		title: miEstasHomoLesson.title,
		description: "Meet people, names, and one cat with simple estas sentences.",
		path: "/lessons/mi-estas-homo",
		completedStageIds: ["mi-estas-homo.typing"],
	},
];

export default function App() {
	// `location` (the canonical path) plus `inStory` fully determine what shows:
	// the main menu ("/"), the lessons menu ("/lessons"), a curriculum step, or
	// the story overlay. There is no longer a per-screen `View` enum.
	const [location, setLocation] = useState<string>(() =>
		canonicalCurriculumPath(window.location.pathname),
	);
	const [inStory, setInStory] = useState(false);
	const [savedStories, setSavedStories] = useState<SavedStorySummary[]>([]);
	const [savesError, setSavesError] = useState<string | null>(null);
	const [model, setModel] = useState<TextModelId>(readSelectedTextModel);

	const lessonProgress = readLessonProgress();
	const hasLessonProgress =
		lessonProgress.lastPath !== FIRST_STEP_PATH ||
		lessonProgress.completedStages.length > 0;

	const goto = useCallback((path: string, options?: { replace?: boolean }) => {
		const canonical = canonicalCurriculumPath(path);
		setInStory(false);
		setLocation(canonical);
		if (window.location.pathname !== canonical) {
			const method = options?.replace ? "replaceState" : "pushState";
			window.history[method](null, "", canonical);
		}
		if (CURRICULUM_PATHS.has(canonical)) {
			rememberLessonPath(canonical);
		}
	}, []);

	const enterStory = useCallback(() => {
		setInStory(true);
		setLocation(MAIN_MENU_PATH);
		if (window.location.pathname !== MAIN_MENU_PATH) {
			window.history.pushState(null, "", MAIN_MENU_PATH);
		}
	}, []);

	const refreshSavedStories = useCallback(async () => {
		try {
			setSavesError(null);
			setSavedStories(await listSavedStories());
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setSavesError(`Could not read local saves: ${message}`);
		}
	}, []);

	const sessionView: "menu" | "story" | "lesson" = inStory
		? "story"
		: location === MAIN_MENU_PATH
			? "menu"
			: "lesson";

	const {
		activeSaveId,
		autoContinueStory,
		backToMenu,
		backgroundImage,
		backgroundIntro,
		completeStoryRecap,
		continueReadingStory,
		currentTarget,
		error,
		genre,
		handleTypingComplete,
		openingAudio,
		phase,
		nonTranslatableWords,
		readingPartIndex,
		readingTotalParts,
		storyFeedbackSubmittedAt,
		restartReadingStory,
		retryStoryRecap,
		resumeStory,
		segments,
		selectGenre,
		skipStoryRecap,
		regenerateWordTranslation,
		startLessonStory,
		startReadingStory,
		streamingTarget,
		storyRecapError,
		storyRecapLesson,
		submitContinuation,
		submitStoryFeedback,
		captureBotQuestions,
		wordTranslations,
	} = useStorySession({
		model,
		view: sessionView,
		onViewChange: (nextView) => {
			if (nextView === "story") enterStory();
			else if (nextView === "menu") goto(MAIN_MENU_PATH);
		},
		onSavedStoriesChanged: refreshSavedStories,
		onSavesError: setSavesError,
	});

	useEffect(() => {
		function handlePopState() {
			const canonical = canonicalCurriculumPath(window.location.pathname);
			setInStory(false);
			setLocation(canonical);
			if (canonical !== window.location.pathname) {
				window.history.replaceState(null, "", canonical);
			}
		}

		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	useEffect(() => {
		const canonical = canonicalCurriculumPath(window.location.pathname);
		if (canonical === window.location.pathname) return;
		window.history.replaceState(null, "", canonical);
		if (CURRICULUM_PATHS.has(canonical)) {
			rememberLessonPath(canonical);
		}
	}, []);

	const { visibleBackgroundUrl, previousBackgroundUrl, isBackgroundFading } =
		useBackgroundLayers(sessionView, backgroundImage);

	const currentStep = CURRICULUM.find((step) => step.path === location);

	function handleModelChange(id: TextModelId) {
		saveSelectedTextModel(id);
		setModel(id);
	}

	const openLessonsMenu = useCallback(() => goto(LESSONS_MENU_PATH), [goto]);
	const returnToMenu = useCallback(() => goto(MAIN_MENU_PATH), [goto]);

	function openLesson() {
		const { lastPath } = readLessonProgress();
		goto(CURRICULUM_PATHS.has(lastPath) ? lastPath : FIRST_STEP_PATH);
	}

	function finishCurriculum() {
		startLessonStory({
			title: gardenLesson.title,
			storyText: gardenLesson.story.join(" "),
		});
	}

	async function removeSavedStory(id: string) {
		try {
			setSavesError(null);
			await deleteSavedStory(id);
			await refreshSavedStories();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setSavesError(`Could not delete story: ${message}`);
		}
	}

	const showMainMenu = !inStory && location === MAIN_MENU_PATH;
	const showLessonsMenu = !inStory && location === LESSONS_MENU_PATH;
	const showCurriculum = !inStory && !!currentStep;
	const appClassName = `app${
		inStory && visibleBackgroundUrl ? " app--story-has-background" : ""
	}`;

	return (
		<div className={appClassName}>
			{inStory && visibleBackgroundUrl && (
				<>
					{previousBackgroundUrl && (
						<div
							className="story-background story-background--previous"
							style={backgroundLayerStyle(previousBackgroundUrl)}
						/>
					)}
					<div
						className={`story-background story-background--current${
							isBackgroundFading ? " story-background--fading" : ""
						}`}
						style={backgroundLayerStyle(visibleBackgroundUrl)}
					/>
				</>
			)}

			{inStory && (
				<header className="story-header">
					<h1>
						{phase === "reading" || readingPartIndex !== null
							? "Story Reading"
							: "Story Typing Practice"}
					</h1>
					<p className="subtitle">
						{genre ? `${genre.emoji} ${genre.label}` : ""}
					</p>
				</header>
			)}

			{showMainMenu && (
				<MainMenu
					savedStories={savedStories}
					savesError={savesError}
					model={model}
					hasLessonProgress={hasLessonProgress}
					onModelChange={handleModelChange}
					onSelect={selectGenre}
					onStartLesson={openLessonsMenu}
					onStartReadingStory={startReadingStory}
					onResume={resumeStory}
					onDelete={removeSavedStory}
				/>
			)}

			{showLessonsMenu && (
				<LessonsMenu
					progress={lessonProgress}
					items={LESSON_MENU_ITEMS}
					onBack={returnToMenu}
					onContinue={openLesson}
					onOpenLessonPath={goto}
				/>
			)}

			{showCurriculum && (
				<CurriculumView
					path={location}
					onNavigate={goto}
					onExit={openLessonsMenu}
					onFinish={finishCurriculum}
				/>
			)}

			{inStory && genre && (
				<ExerciseScreen
					segments={segments}
					currentTarget={currentTarget}
					streamingTarget={streamingTarget}
					phase={phase}
					error={error}
					backgroundIntro={backgroundIntro ?? undefined}
					storyId={activeSaveId}
					currentImageUrl={backgroundImage?.backgroundImageUrl ?? null}
					openingAudioUrl={openingAudio?.openingAudioUrl ?? null}
					readingPartIndex={readingPartIndex}
					readingTotalParts={readingTotalParts}
					storyFeedbackSubmittedAt={storyFeedbackSubmittedAt}
					wordTranslations={wordTranslations}
					nonTranslatableWords={nonTranslatableWords}
					storyRecapLesson={storyRecapLesson}
					storyRecapError={storyRecapError}
					onRegenerateWord={regenerateWordTranslation}
					onContinueReading={continueReadingStory}
					onCompleteStoryRecap={completeStoryRecap}
					onRetryStoryRecap={retryStoryRecap}
					onSkipStoryRecap={skipStoryRecap}
					onRestartStory={restartReadingStory}
					onTypingComplete={handleTypingComplete}
					onSubmitContinuation={submitContinuation}
					onAutoContinue={autoContinueStory}
					onBackToMenu={backToMenu}
					onSubmitStoryFeedback={submitStoryFeedback}
					onCaptureBotQuestions={captureBotQuestions}
				/>
			)}
		</div>
	);
}
