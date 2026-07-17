import { useState } from "react";
import type { Genre } from "../genres";
import { genres } from "../genres";
import type { TextModelId } from "../models";
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
	model: TextModelId;
	hasLessonProgress: boolean;
	readingStoryStatus: ReadingPreparationStatus;
	hasUnfinishedReadingStory: boolean;
	onModelChange: (id: TextModelId) => void;
	onSelect: (genre: Genre) => void;
	onStartLesson: () => void;
	onStartReadingStory: () => void;
	onRetryReadingStory: () => void;
	onResume: (id: string) => void;
	onDelete: (id: string) => void;
}

export default function MainMenu({
	savedStories,
	savesError,
	model,
	hasLessonProgress,
	readingStoryStatus,
	hasUnfinishedReadingStory,
	onModelChange,
	onSelect,
	onStartLesson,
	onStartReadingStory,
	onRetryReadingStory,
	onResume,
	onDelete,
}: MainMenuProps) {
	const [settingsOpen, setSettingsOpen] = useState(false);
	const lessonGenre =
		genres.find((genre) => genre.id === "esperanto") ?? genres[0];
	const lessonSaves = savedStories.filter(
		(story) => story.genreId === "esperanto",
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
					<h1 id="lesson-hero-title">Esperanto through tiny stories</h1>
					<div className="lesson-hero__actions">
						<button
							type="button"
							className="lesson-hero__start"
							onClick={onStartLesson}
						>
							{hasLessonProgress ? "Lessons" : "Start Lessons"}
						</button>
						<button
							type="button"
							className="lesson-hero__start lesson-hero__start--secondary"
							onClick={() => onSelect(lessonGenre)}
						>
							Typing Story
						</button>
						<button
							type="button"
							className={`lesson-hero__start lesson-hero__start--secondary${
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
					model={model}
					onModelChange={onModelChange}
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
