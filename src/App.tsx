import { useCallback, useEffect, useState } from "react";
import ExerciseScreen from "./exercise_screen/ExerciseScreen";
import MainMenu from "./home_menu/MainMenu";
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

type View = "menu" | "story";

export default function App() {
	const [view, setView] = useState<View>("menu");
	const [savedStories, setSavedStories] = useState<SavedStorySummary[]>([]);
	const [savesError, setSavesError] = useState<string | null>(null);
	const [model, setModel] = useState<TextModelId>(readSelectedTextModel);

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
		phase,
		resumeStory,
		segments,
		selectGenre,
		streamingTarget,
		submitContinuation,
	} = useStorySession({
		model,
		view,
		onViewChange: setView,
		onSavedStoriesChanged: refreshSavedStories,
		onSavesError: setSavesError,
	});

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

			<header className="header">
				<h1>Story Typing Practice</h1>
				<p className="subtitle">
					{view === "story" && genre
						? `${genre.emoji} ${genre.label}`
						: "An interactive AI story"}
				</p>
			</header>

			{view === "menu" && (
				<MainMenu
					savedStories={savedStories}
					savesError={savesError}
					model={model}
					onModelChange={handleModelChange}
					onSelect={selectGenre}
					onResume={resumeStory}
					onDelete={removeSavedStory}
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
					onTypingComplete={handleTypingComplete}
					onSubmitContinuation={submitContinuation}
					onAutoContinue={autoContinueStory}
					onBackToMenu={backToMenu}
				/>
			)}
		</div>
	);
}
