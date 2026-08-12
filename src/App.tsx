import { useCallback, useEffect, useState } from "react";
import ExerciseScreen from "./exercise_screen/ExerciseScreen";
import MainMenu from "./home_menu/MainMenu";
import {
	readSelectedStoryGenerationPreset,
	saveSelectedStoryGenerationPreset,
} from "./modelSelection/modelSelectionStore";
import {
	getStoryGenerationPreset,
	type StoryGenerationPresetId,
} from "./models";
import {
	deleteSavedStory,
	findUnfinishedReadingSave,
	listSavedStories,
	type SavedStorySummary,
} from "./saves";
import {
	backgroundLayerStyle,
	useBackgroundLayers,
} from "./story_session/background";
import { useStorySession } from "./story_session/useStorySession";

const MAIN_MENU_PATH = "/";

function canonicalAppPath(path: string) {
	return path === MAIN_MENU_PATH ? path : MAIN_MENU_PATH;
}

export default function App() {
	const [location, setLocation] = useState<string>(() =>
		canonicalAppPath(window.location.pathname),
	);
	const [inStory, setInStory] = useState(false);
	const [savedStories, setSavedStories] = useState<SavedStorySummary[]>([]);
	const [savesError, setSavesError] = useState<string | null>(null);
	const [storyGenerationPresetId, setStoryGenerationPresetId] =
		useState<StoryGenerationPresetId>(readSelectedStoryGenerationPreset);
	const storyGeneration = getStoryGenerationPreset(storyGenerationPresetId);

	const goto = useCallback((path: string, options?: { replace?: boolean }) => {
		const canonical = canonicalAppPath(path);
		setInStory(false);
		setLocation(canonical);
		if (window.location.pathname !== canonical) {
			const method = options?.replace ? "replaceState" : "pushState";
			window.history[method](null, "", canonical);
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

	const unfinishedReadingSave = findUnfinishedReadingSave(savedStories);

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
		openingAudioLoading,
		openingAudioError,
		retryOpeningAudio,
		phase,
		nonTranslatableWords,
		readingPartIndex,
		readingPreparationStatus,
		retryReadingPreparation,
		readingTotalParts,
		storyFeedbackSubmittedAt,
		storyFeedback,
		feedbackEditable,
		onStoryFeedbackDraftChange,
		retryStoryRecap,
		resumeStory,
		segments,
		skipStoryRecap,
		regenerateWordTranslation,
		startReadingStory,
		streamingTarget,
		storyRecapError,
		storyRecapLesson,
		submitContinuation,
		submitStoryFeedback,
		captureBotQuestions,
		wordTranslations,
	} = useStorySession({
		storyGeneration,
		view: sessionView,
		unfinishedReadingSaveId: unfinishedReadingSave?.id ?? null,
		onViewChange: (nextView) => {
			if (nextView === "story") enterStory();
			else if (nextView === "menu") goto(MAIN_MENU_PATH);
		},
		onSavedStoriesChanged: refreshSavedStories,
		onSavesError: setSavesError,
	});

	useEffect(() => {
		function handlePopState() {
			const canonical = canonicalAppPath(window.location.pathname);
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
		const canonical = canonicalAppPath(window.location.pathname);
		if (canonical === window.location.pathname) return;
		window.history.replaceState(null, "", canonical);
	}, []);

	const { visibleBackgroundUrl, previousBackgroundUrl, isBackgroundFading } =
		useBackgroundLayers(sessionView, backgroundImage);

	function handleStoryGenerationPresetChange(id: StoryGenerationPresetId) {
		saveSelectedStoryGenerationPreset(id);
		setStoryGenerationPresetId(id);
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
					<h1>Story Reading</h1>
					<p className="subtitle">
						{genre ? `${genre.emoji} ${genre.label}` : ""}
					</p>
				</header>
			)}

			{showMainMenu && (
				<MainMenu
					savedStories={savedStories}
					savesError={savesError}
					storyGenerationPreset={storyGenerationPresetId}
					onStoryGenerationPresetChange={handleStoryGenerationPresetChange}
					onStartReadingStory={
						unfinishedReadingSave
							? () => resumeStory(unfinishedReadingSave.id)
							: startReadingStory
					}
					hasUnfinishedReadingStory={Boolean(unfinishedReadingSave)}
					readingStoryStatus={readingPreparationStatus}
					onRetryReadingStory={retryReadingPreparation}
					onResume={resumeStory}
					onDelete={removeSavedStory}
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
					openingAudioLoading={openingAudioLoading}
					openingAudioError={openingAudioError}
					onRetryOpeningAudio={retryOpeningAudio}
					readingPartIndex={readingPartIndex}
					readingTotalParts={readingTotalParts}
					storyFeedbackSubmittedAt={storyFeedbackSubmittedAt}
					storyFeedback={storyFeedback}
					feedbackEditable={feedbackEditable}
					wordTranslations={wordTranslations}
					nonTranslatableWords={nonTranslatableWords}
					storyRecapLesson={storyRecapLesson}
					storyRecapError={storyRecapError}
					onRegenerateWord={regenerateWordTranslation}
					onContinueReading={continueReadingStory}
					onCompleteStoryRecap={completeStoryRecap}
					onRetryStoryRecap={retryStoryRecap}
					onSkipStoryRecap={skipStoryRecap}
					onTypingComplete={handleTypingComplete}
					onSubmitContinuation={submitContinuation}
					onAutoContinue={autoContinueStory}
					onBackToMenu={backToMenu}
					onSubmitStoryFeedback={submitStoryFeedback}
					onStoryFeedbackDraftChange={onStoryFeedbackDraftChange}
					onCaptureBotQuestions={captureBotQuestions}
				/>
			)}
		</div>
	);
}
