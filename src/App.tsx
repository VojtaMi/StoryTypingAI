import { useCallback, useEffect, useState } from "react";
import ExerciseScreen from "./exercise_screen/ExerciseScreen";
import MainMenu from "./home_menu/MainMenu";
import EsperantoIntro from "./lessons/EsperantoIntro";
import KeyboardIntroExercise from "./lessons/KeyboardIntroExercise";
import LessonIntro from "./lessons/LessonIntro";
import LessonTypingExercise from "./lessons/LessonTypingExercise";
import {
	completeLessonStage,
	readLessonProgress,
	rememberLessonPath,
} from "./lessons/lessonProgress";
import { firstLesson } from "./lessons/lessons";
import type { Lesson } from "./lessons/types";
import WordMatchExercise from "./lessons/WordMatchExercise";
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

type View =
	| "menu"
	| "esperanto-intro"
	| "lesson"
	| "word-match"
	| "lesson-typing"
	| "keyboard-intro"
	| "story";

const ROUTES = {
	menu: "/",
	intro: "/lessons/intro",
	hundo: "/lessons/hundo-estas-besto",
	hundoWordMatch: "/lessons/hundo-estas-besto/word-match",
	hundoTyping: "/lessons/hundo-estas-besto/typing",
	keyboard: "/lessons/esperanto-keyboard",
} as const;

const LESSON_PATHS = new Set<string>([
	ROUTES.intro,
	ROUTES.hundo,
	ROUTES.hundoWordMatch,
	ROUTES.hundoTyping,
	ROUTES.keyboard,
]);

const NUMBERED_LESSON_PATHS: Record<string, string> = {
	"/lessons/1": ROUTES.intro,
	"/lessons/2": ROUTES.hundo,
	"/lessons/3": ROUTES.hundoWordMatch,
	"/lessons/4": ROUTES.hundoTyping,
	"/lessons/5": ROUTES.keyboard,
};

function canonicalLessonPath(pathname: string) {
	return NUMBERED_LESSON_PATHS[pathname] ?? pathname;
}

function viewFromPath(pathname: string): View {
	switch (canonicalLessonPath(pathname)) {
		case ROUTES.intro:
			return "esperanto-intro";
		case ROUTES.hundo:
			return "lesson";
		case ROUTES.hundoWordMatch:
			return "word-match";
		case ROUTES.hundoTyping:
			return "lesson-typing";
		case ROUTES.keyboard:
			return "keyboard-intro";
		default:
			return "menu";
	}
}

function pathForView(view: View) {
	switch (view) {
		case "esperanto-intro":
			return ROUTES.intro;
		case "lesson":
			return ROUTES.hundo;
		case "word-match":
			return ROUTES.hundoWordMatch;
		case "lesson-typing":
			return ROUTES.hundoTyping;
		case "keyboard-intro":
			return ROUTES.keyboard;
		default:
			return ROUTES.menu;
	}
}

export default function App() {
	const [view, setView] = useState<View>(() =>
		viewFromPath(window.location.pathname),
	);
	const [activeLesson, setActiveLesson] = useState<Lesson>(firstLesson);
	const [savedStories, setSavedStories] = useState<SavedStorySummary[]>([]);
	const [savesError, setSavesError] = useState<string | null>(null);
	const [model, setModel] = useState<TextModelId>(readSelectedTextModel);
	const lessonProgress = readLessonProgress();
	const hasLessonProgress =
		lessonProgress.lastPath !== ROUTES.intro ||
		lessonProgress.completedStages.length > 0;

	const navigateToView = useCallback(
		(nextView: View, options?: { replace?: boolean }) => {
			const path = pathForView(nextView);
			setView(nextView);
			if (window.location.pathname !== path) {
				const method = options?.replace ? "replaceState" : "pushState";
				window.history[method](null, "", path);
			}
			if (LESSON_PATHS.has(path)) {
				rememberLessonPath(path);
			}
		},
		[],
	);

	const refreshSavedStories = useCallback(async () => {
		try {
			setSavesError(null);
			setSavedStories(await listSavedStories());
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setSavesError(`Could not read local saves: ${message}`);
		}
	}, []);

	const {
		activeSaveId,
		autoContinueStory,
		backToMenu,
		backgroundImage,
		backgroundIntro,
		currentTarget,
		error,
		genre,
		handleTypingComplete,
		openingAudio,
		phase,
		resumeStory,
		segments,
		selectGenre,
		startLessonStory,
		streamingTarget,
		submitContinuation,
	} = useStorySession({
		model,
		view,
		onViewChange: (nextView) => navigateToView(nextView),
		onSavedStoriesChanged: refreshSavedStories,
		onSavesError: setSavesError,
	});

	useEffect(() => {
		function handlePopState() {
			const path = canonicalLessonPath(window.location.pathname);
			setView(viewFromPath(path));
			if (path !== window.location.pathname) {
				window.history.replaceState(null, "", path);
			}
		}

		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	useEffect(() => {
		const path = canonicalLessonPath(window.location.pathname);
		if (path === window.location.pathname) return;
		window.history.replaceState(null, "", path);
		rememberLessonPath(path);
	}, []);

	const { visibleBackgroundUrl, previousBackgroundUrl, isBackgroundFading } =
		useBackgroundLayers(view, backgroundImage);

	useEffect(() => {
		document.body.dataset.view = view;
		if (genre) {
			document.body.dataset.genre = genre.id;
		} else {
			delete document.body.dataset.genre;
		}
		return () => {
			delete document.body.dataset.view;
			delete document.body.dataset.genre;
		};
	}, [view, genre]);

	function handleModelChange(id: TextModelId) {
		saveSelectedTextModel(id);
		setModel(id);
	}

	function openLessonPath(path: string) {
		setActiveLesson(firstLesson);
		const nextView = viewFromPath(canonicalLessonPath(path));
		navigateToView(nextView === "menu" ? "esperanto-intro" : nextView);
	}

	function openLesson() {
		const { lastPath } = readLessonProgress();
		openLessonPath(LESSON_PATHS.has(lastPath) ? lastPath : ROUTES.intro);
	}

	function returnToMenu() {
		navigateToView("menu");
	}

	function beginFirstExercise() {
		completeLessonStage("intro", ROUTES.hundo);
		openLessonPath(ROUTES.hundo);
	}

	function beginLessonPractice(lesson: Lesson) {
		setActiveLesson(lesson);
		navigateToView("word-match");
	}

	function handleWordMatchComplete() {
		completeLessonStage("hundo-estas-besto.word-match", ROUTES.hundoTyping);
		navigateToView("lesson-typing");
	}

	function handleLessonTypingComplete() {
		completeLessonStage("hundo-estas-besto.typing", ROUTES.keyboard);
		navigateToView("keyboard-intro");
	}

	function handleKeyboardIntroComplete() {
		completeLessonStage("esperanto-keyboard", ROUTES.keyboard);
		startLessonStory({
			title: activeLesson.title,
			storyText: activeLesson.story.join(" "),
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

	return (
		<div className={`app app--${view}`}>
			{view === "story" && visibleBackgroundUrl && (
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

			{view === "story" && (
				<header className="header">
					<h1>Story Typing Practice</h1>
					<p className="subtitle">
						{genre ? `${genre.emoji} ${genre.label}` : ""}
					</p>
				</header>
			)}

			{view === "menu" && (
				<MainMenu
					savedStories={savedStories}
					savesError={savesError}
					model={model}
					hasLessonProgress={hasLessonProgress}
					onModelChange={handleModelChange}
					onSelect={selectGenre}
					onStartLesson={openLesson}
					onResume={resumeStory}
					onDelete={removeSavedStory}
				/>
			)}

			{view === "esperanto-intro" && (
				<EsperantoIntro onStart={beginFirstExercise} onBack={returnToMenu} />
			)}

			{view === "lesson" && (
				<LessonIntro
					lesson={activeLesson}
					onBeginPractice={beginLessonPractice}
					onBack={() => navigateToView("esperanto-intro")}
				/>
			)}

			{view === "word-match" && (
				<WordMatchExercise
					lessonId={activeLesson.id}
					words={activeLesson.introducedWords}
					onComplete={handleWordMatchComplete}
					onBack={() => navigateToView("lesson")}
				/>
			)}

			{view === "lesson-typing" && (
				<LessonTypingExercise
					lessonId={activeLesson.id}
					text={activeLesson.story.join(" ")}
					imageUrl="/images/lesson-typing-bg.webp"
					onComplete={handleLessonTypingComplete}
					onBack={() => navigateToView("word-match")}
				/>
			)}

			{view === "keyboard-intro" && (
				<KeyboardIntroExercise
					onComplete={handleKeyboardIntroComplete}
					onBack={() => navigateToView("lesson-typing")}
				/>
			)}

			{view === "story" && genre && (
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
					onTypingComplete={handleTypingComplete}
					onSubmitContinuation={submitContinuation}
					onAutoContinue={autoContinueStory}
					onBackToMenu={backToMenu}
				/>
			)}
		</div>
	);
}
