import { useCallback, useEffect, useState } from "react";
import ExerciseScreen from "./exercise_screen/ExerciseScreen";
import MainMenu from "./home_menu/MainMenu";
import LessonsMenu from "./lessons/LessonsMenu";
import {
	completeLessonStage,
	readLessonProgress,
	rememberLessonPath,
} from "./lessons/lessonProgress";
import EsperantoIntro from "./lessons/predefined/EsperantoIntro";
import KeyboardIntroExercise from "./lessons/predefined/KeyboardIntroExercise";
import KeyboardWordsExercise from "./lessons/predefined/KeyboardWordsExercise";
import { KEYBOARD_PRACTICE_WORDS } from "./lessons/predefined/keyboardPracticeWords";
import { firstLesson, gardenLesson } from "./lessons/predefined/lessons";
import LessonIntro from "./lessons/templates/LessonIntro";
import LessonTypingExercise from "./lessons/templates/LessonTypingExercise";
import PhraseBuilderExercise from "./lessons/templates/PhraseBuilderExercise";
import WordMatchExercise from "./lessons/templates/WordMatchExercise";
import type {
	Lesson,
	LessonExercise,
	PhraseBuilderLessonExercise,
	WordMatchLessonExercise,
} from "./lessons/types";
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
	| "lessons-menu"
	| "esperanto-intro"
	| "lesson"
	| "word-match"
	| "lesson-typing"
	| "keyboard-intro"
	| "keyboard-words"
	| "keyboard-word-match"
	| "garden-lesson"
	| "garden-word-match"
	| "garden-phrase-builder"
	| "garden-typing"
	| "story";

const ROUTES = {
	menu: "/",
	lessons: "/lessons",
	intro: "/lessons/intro",
	hundo: "/lessons/hundo-estas-besto",
	hundoWordMatch: "/lessons/hundo-estas-besto/word-match",
	hundoTyping: "/lessons/hundo-estas-besto/typing",
	keyboard: "/lessons/esperanto-keyboard",
	keyboardWords: "/lessons/esperanto-keyboard/words",
	keyboardWordMatch: "/lessons/esperanto-keyboard/word-match",
	garden: "/lessons/nia-gardeno",
	gardenWordMatch: "/lessons/nia-gardeno/word-match",
	gardenPhraseBuilder: "/lessons/nia-gardeno/phrase-builder",
	gardenTyping: "/lessons/nia-gardeno/typing",
} as const;

const LESSON_PATHS = new Set<string>([
	ROUTES.intro,
	ROUTES.hundo,
	ROUTES.hundoWordMatch,
	ROUTES.hundoTyping,
	ROUTES.keyboard,
	ROUTES.keyboardWords,
	ROUTES.keyboardWordMatch,
	ROUTES.garden,
	ROUTES.gardenWordMatch,
	ROUTES.gardenPhraseBuilder,
	ROUTES.gardenTyping,
]);

const NUMBERED_LESSON_PATHS: Record<string, string> = {
	"/lessons/0": ROUTES.intro,
	"/lessons/1": ROUTES.hundo,
	"/lessons/2": ROUTES.hundoWordMatch,
	"/lessons/3": ROUTES.hundoTyping,
	"/lessons/4": ROUTES.keyboard,
	"/lessons/5": ROUTES.keyboardWords,
	"/lessons/6": ROUTES.keyboardWordMatch,
	"/lessons/7": ROUTES.garden,
	"/lessons/8": ROUTES.gardenWordMatch,
	"/lessons/9": ROUTES.gardenPhraseBuilder,
	"/lessons/10": ROUTES.gardenTyping,
};

function canonicalLessonPath(pathname: string) {
	return NUMBERED_LESSON_PATHS[pathname] ?? pathname;
}

function viewFromPath(pathname: string): View {
	switch (canonicalLessonPath(pathname)) {
		case ROUTES.lessons:
			return "lessons-menu";
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
		case ROUTES.keyboardWords:
			return "keyboard-words";
		case ROUTES.keyboardWordMatch:
			return "keyboard-word-match";
		case ROUTES.garden:
			return "garden-lesson";
		case ROUTES.gardenWordMatch:
			return "garden-word-match";
		case ROUTES.gardenPhraseBuilder:
			return "garden-phrase-builder";
		case ROUTES.gardenTyping:
			return "garden-typing";
		default:
			return "menu";
	}
}

function pathForView(view: View) {
	switch (view) {
		case "lessons-menu":
			return ROUTES.lessons;
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
		case "keyboard-words":
			return ROUTES.keyboardWords;
		case "keyboard-word-match":
			return ROUTES.keyboardWordMatch;
		case "garden-lesson":
			return ROUTES.garden;
		case "garden-word-match":
			return ROUTES.gardenWordMatch;
		case "garden-phrase-builder":
			return ROUTES.gardenPhraseBuilder;
		case "garden-typing":
			return ROUTES.gardenTyping;
		default:
			return ROUTES.menu;
	}
}

function lessonForPath(path: string) {
	return path.startsWith(ROUTES.garden) ? gardenLesson : firstLesson;
}

function findExercise<T extends LessonExercise["type"]>(
	lesson: Lesson,
	type: T,
): Extract<LessonExercise, { type: T }> {
	const exercise = lesson.exercises.find(
		(candidate) => candidate.type === type,
	);
	if (!exercise) {
		throw new Error(`Lesson ${lesson.id} is missing a ${type} exercise.`);
	}
	return exercise as Extract<LessonExercise, { type: T }>;
}

function wordsForWordMatch(lesson: Lesson, exercise: WordMatchLessonExercise) {
	if (!exercise.wordTerms) return lesson.introducedWords;
	const requested = new Set(exercise.wordTerms);
	return lesson.introducedWords.filter((word) => requested.has(word.term));
}

const LESSON_MENU_ITEMS = [
	{
		id: "intro",
		title: "Intro",
		description: "Meet the course and the tiny-story format.",
		path: ROUTES.intro,
		completedStageIds: ["intro"],
	},
	{
		id: "hundo-estas-besto",
		title: firstLesson.title,
		description: "Learn hundo, estas, and besto through your first sentence.",
		path: ROUTES.hundo,
		completedStageIds: [
			"hundo-estas-besto.word-match",
			"hundo-estas-besto.typing",
		],
	},
	{
		id: "keyboard",
		title: "Keyboard",
		description: "Practise Esperanto characters, then type beginner words.",
		path: ROUTES.keyboard,
		completedStageIds: ["esperanto-keyboard"],
	},
	{
		id: "nia-gardeno",
		title: gardenLesson.title,
		description:
			"Combine colors, ownership, and known nouns into a tiny scene.",
		path: ROUTES.garden,
		completedStageIds: ["nia-gardeno.typing"],
	},
];

export default function App() {
	const [view, setView] = useState<View>(() =>
		viewFromPath(window.location.pathname),
	);
	const [activeLesson, setActiveLesson] = useState<Lesson>(() =>
		lessonForPath(canonicalLessonPath(window.location.pathname)),
	);
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
	const gardenWordMatchExercise = findExercise(
		gardenLesson,
		"word-match",
	) as WordMatchLessonExercise;
	const gardenPhraseBuilderExercise = findExercise(
		gardenLesson,
		"phrase-builder",
	) as PhraseBuilderLessonExercise;

	useEffect(() => {
		function handlePopState() {
			const path = canonicalLessonPath(window.location.pathname);
			setView(viewFromPath(path));
			setActiveLesson(lessonForPath(path));
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
		const canonicalPath = canonicalLessonPath(path);
		setActiveLesson(lessonForPath(canonicalPath));
		const nextView = viewFromPath(canonicalPath);
		navigateToView(nextView === "menu" ? "esperanto-intro" : nextView);
	}

	function openLesson() {
		const { lastPath } = readLessonProgress();
		openLessonPath(LESSON_PATHS.has(lastPath) ? lastPath : ROUTES.intro);
	}

	function openLessonsMenu() {
		navigateToView("lessons-menu");
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
		navigateToView(
			lesson.id === gardenLesson.id ? "garden-word-match" : "word-match",
		);
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
		completeLessonStage("esperanto-keyboard.chars", ROUTES.keyboardWords);
		navigateToView("keyboard-words");
	}

	function handleKeyboardWordsComplete() {
		completeLessonStage("esperanto-keyboard.words", ROUTES.keyboardWordMatch);
		navigateToView("keyboard-word-match");
	}

	function handleKeyboardWordMatchComplete() {
		completeLessonStage("esperanto-keyboard", ROUTES.garden);
		setActiveLesson(gardenLesson);
		navigateToView("garden-lesson");
	}

	function handleGardenWordMatchComplete() {
		completeLessonStage("nia-gardeno.word-match", ROUTES.gardenPhraseBuilder);
		navigateToView("garden-phrase-builder");
	}

	function handleGardenPhraseBuilderComplete() {
		completeLessonStage("nia-gardeno.phrase-builder", ROUTES.gardenTyping);
		navigateToView("garden-typing");
	}

	function handleGardenTypingComplete() {
		completeLessonStage("nia-gardeno.typing", ROUTES.garden);
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
					onStartLesson={openLessonsMenu}
					onResume={resumeStory}
					onDelete={removeSavedStory}
				/>
			)}

			{view === "lessons-menu" && (
				<LessonsMenu
					progress={lessonProgress}
					items={LESSON_MENU_ITEMS}
					onBack={returnToMenu}
					onContinue={openLesson}
					onOpenLessonPath={openLessonPath}
				/>
			)}

			{view === "esperanto-intro" && (
				<EsperantoIntro onStart={beginFirstExercise} onBack={openLessonsMenu} />
			)}

			{view === "lesson" && (
				<LessonIntro
					lesson={activeLesson}
					onBeginPractice={beginLessonPractice}
					onBack={openLessonsMenu}
				/>
			)}

			{view === "word-match" && (
				<WordMatchExercise
					lessonId={activeLesson.id}
					words={activeLesson.introducedWords}
					onComplete={handleWordMatchComplete}
					onBack={openLessonsMenu}
				/>
			)}

			{view === "lesson-typing" && (
				<LessonTypingExercise
					lessonId={activeLesson.id}
					text={activeLesson.story.join(" ")}
					imageUrl="/images/lesson-typing-bg.webp"
					onComplete={handleLessonTypingComplete}
					onBack={openLessonsMenu}
				/>
			)}

			{view === "keyboard-intro" && (
				<KeyboardIntroExercise
					onComplete={handleKeyboardIntroComplete}
					onBack={openLessonsMenu}
				/>
			)}

			{view === "keyboard-words" && (
				<KeyboardWordsExercise
					onComplete={handleKeyboardWordsComplete}
					onBack={openLessonsMenu}
				/>
			)}

			{view === "keyboard-word-match" && (
				<WordMatchExercise
					lessonId="keyboard-intro"
					words={KEYBOARD_PRACTICE_WORDS}
					completeLabel="Continue →"
					onComplete={handleKeyboardWordMatchComplete}
					onBack={openLessonsMenu}
				/>
			)}

			{view === "garden-lesson" && (
				<LessonIntro
					lesson={gardenLesson}
					onBeginPractice={beginLessonPractice}
					onBack={openLessonsMenu}
				/>
			)}

			{view === "garden-word-match" && (
				<WordMatchExercise
					lessonId={gardenLesson.id}
					words={wordsForWordMatch(gardenLesson, gardenWordMatchExercise)}
					title={gardenWordMatchExercise.title}
					hint={gardenWordMatchExercise.hint}
					completeLabel={gardenWordMatchExercise.completeLabel}
					onComplete={handleGardenWordMatchComplete}
					onBack={openLessonsMenu}
				/>
			)}

			{view === "garden-phrase-builder" && (
				<PhraseBuilderExercise
					lessonId={gardenLesson.id}
					title={gardenPhraseBuilderExercise.title}
					hint={gardenPhraseBuilderExercise.hint}
					prompts={gardenPhraseBuilderExercise.prompts}
					completeLabel={gardenPhraseBuilderExercise.completeLabel}
					onComplete={handleGardenPhraseBuilderComplete}
					onBack={openLessonsMenu}
				/>
			)}

			{view === "garden-typing" && (
				<LessonTypingExercise
					lessonId={gardenLesson.id}
					text={gardenLesson.story.join(" ")}
					imageUrl={
						findExercise(gardenLesson, "typing-story").imageUrl ??
						"/images/lesson-typing-bg.webp"
					}
					onComplete={handleGardenTypingComplete}
					onBack={openLessonsMenu}
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
