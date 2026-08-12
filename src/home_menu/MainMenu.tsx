import { useState } from "react";
import type { StoryGenerationPresetId } from "../models";
import type { SavedStorySummary } from "../saves";
import {
	isReadingPreparationBusy,
	type ReadingPreparationStatus,
} from "../story_session/useReadingPreparation";
import "./menu.css";
import { SettingsPanel } from "./SettingsPanel";
import { SavedStories } from "./savedStories/SavedStories";

interface MainMenuProps {
	savedStories: SavedStorySummary[];
	savesError: string | null;
	storyGenerationPreset: StoryGenerationPresetId;
	readingStoryStatus: ReadingPreparationStatus;
	hasUnfinishedReadingStory: boolean;
	onStoryGenerationPresetChange: (id: StoryGenerationPresetId) => void;
	onStartReadingStory: () => void;
	onRetryReadingStory: () => void;
	onResume: (id: string) => void;
	onDelete: (id: string) => void;
}

export default function MainMenu({
	savedStories,
	savesError,
	storyGenerationPreset,
	readingStoryStatus,
	hasUnfinishedReadingStory,
	onStoryGenerationPresetChange,
	onStartReadingStory,
	onRetryReadingStory,
	onResume,
	onDelete,
}: MainMenuProps) {
	const [settingsOpen, setSettingsOpen] = useState(false);
	const lessonSaves = savedStories.filter(
		(story) => story.genreId === "spanish",
	);
	const makingReadingStory = isReadingPreparationBusy(readingStoryStatus);
	const readingStoryFailed = readingStoryStatus === "error";

	return (
		<div className="menu">
			<button
				type="button"
				className="menu__settings-button"
				onClick={() => setSettingsOpen(true)}
				aria-label="Open settings"
			>
				⚙ Settings
			</button>
			<section className="lesson-hero" aria-labelledby="lesson-hero-title">
				<div className="lesson-hero__content">
					<h1 id="lesson-hero-title">Spanish through tiny stories</h1>
					<div className="lesson-hero__actions">
						<button
							type="button"
							className={`lesson-hero__start${
								makingReadingStory ? " lesson-hero__start--making" : ""
							}`}
							onClick={
								readingStoryFailed ? onRetryReadingStory : onStartReadingStory
							}
							disabled={makingReadingStory}
							aria-busy={makingReadingStory}
						>
							{makingReadingStory
								? "Making story…"
								: readingStoryFailed
									? "Retry story"
									: hasUnfinishedReadingStory
										? "Continue Story"
										: "Reading Story"}
						</button>
					</div>
				</div>
			</section>
			{settingsOpen && (
				<SettingsPanel
					storyGenerationPreset={storyGenerationPreset}
					onStoryGenerationPresetChange={onStoryGenerationPresetChange}
					onClose={() => setSettingsOpen(false)}
				/>
			)}
			<SavedStories
				savedStories={lessonSaves}
				savesError={savesError}
				onResume={onResume}
				onDelete={onDelete}
			/>
		</div>
	);
}
