import { useCallback, useEffect, useState } from "react";
import ExerciseScreen from "./exercise_screen/ExerciseScreen";
import MainMenu from "./home_menu/MainMenu";
import {
	readSelectedLanguage,
	selectLanguage,
	syncLanguageDocument,
} from "./languageSelection";
import { getLanguage, type LanguageId } from "./languages";
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
	const [languageId, setLanguageId] = useState(readSelectedLanguage);

	useEffect(() => {
		syncLanguageDocument(languageId);
		const url = new URL(window.location.href);
		if (url.searchParams.get("language") !== languageId) {
			url.searchParams.set("language", languageId);
			window.history.replaceState(null, "", url);
		}
	}, [languageId]);

	useEffect(() => {
		function handlePopState() {
			setLanguageId(readSelectedLanguage());
		}
		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	function changeLanguage(nextLanguageId: LanguageId) {
		selectLanguage(nextLanguageId);
		setLanguageId(nextLanguageId);
	}

	return (
		<ReadingApp
			key={languageId}
			languageId={languageId}
			onLanguageChange={changeLanguage}
		/>
	);
}

function ReadingApp({
	languageId,
	onLanguageChange,
}: {
	languageId: LanguageId;
	onLanguageChange: (languageId: LanguageId) => void;
}) {
	const language = getLanguage(languageId);
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
			setSavedStories(await listSavedStories(language.id));
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setSavesError(`Could not read local saves: ${message}`);
		}
	}, [language.id]);

	const sessionView: "menu" | "story" = inStory ? "story" : "menu";

	const languageSavedStories = savedStories.filter(
		(save) => save.genreId === language.id,
	);
	const unfinishedReadingSave = findUnfinishedReadingSave(languageSavedStories);

	const {
		activeSaveId,
		backToMenu,
		backgroundImage,
		backgroundIntro,
		completeStoryRecap,
		continueReadingStory,
		currentTarget,
		error,
		genre,
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
		storyRecapError,
		storyRecapLesson,
		submitStoryFeedback,
		captureBotQuestions,
		wordTranslations,
	} = useStorySession({
		language,
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
					<p className="subtitle">{genre?.label ?? ""}</p>
				</header>
			)}

			{showMainMenu && (
				<MainMenu
					language={language}
					savedStories={languageSavedStories}
					savesError={savesError}
					storyGenerationPreset={storyGenerationPresetId}
					onLanguageChange={onLanguageChange}
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
					language={language}
					segments={segments}
					currentTarget={currentTarget}
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
					onBackToMenu={backToMenu}
					onSubmitStoryFeedback={submitStoryFeedback}
					onStoryFeedbackDraftChange={onStoryFeedbackDraftChange}
					onCaptureBotQuestions={captureBotQuestions}
				/>
			)}
		</div>
	);
}
