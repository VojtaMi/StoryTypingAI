import { type CSSProperties, useState } from "react";
import { type Genre, type GenreId, genres } from "../genres";
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
	language: Genre;
	savesError: string | null;
	storyGenerationPreset: StoryGenerationPresetId;
	readingStoryStatus: ReadingPreparationStatus;
	hasUnfinishedReadingStory: boolean;
	onStoryGenerationPresetChange: (id: StoryGenerationPresetId) => void;
	onLanguageChange: (languageId: GenreId) => void;
	onStartReadingStory: () => void;
	onRetryReadingStory: () => void;
	onResume: (id: string) => void;
	onDelete: (id: string) => void;
}

export default function MainMenu({
	savedStories,
	language,
	savesError,
	storyGenerationPreset,
	readingStoryStatus,
	hasUnfinishedReadingStory,
	onStoryGenerationPresetChange,
	onLanguageChange,
	onStartReadingStory,
	onRetryReadingStory,
	onResume,
	onDelete,
}: MainMenuProps) {
	const [settingsOpen, setSettingsOpen] = useState(false);
	const makingReadingStory = isReadingPreparationBusy(readingStoryStatus);
	const readingStoryFailed = readingStoryStatus === "error";

	return (
		<div
			className="menu"
			style={
				{
					"--menu-hero-image": `url(${language.heroImageUrl})`,
				} as CSSProperties
			}
		>
			<div className="menu__settings">
				<label className="menu__language-select">
					<span className="sr-only">Learning language</span>
					<select
						value={language.id}
						onChange={(event) =>
							onLanguageChange(event.target.value as GenreId)
						}
					>
						{genres.map((candidate) => (
							<option key={candidate.id} value={candidate.id}>
								{candidate.label}
							</option>
						))}
					</select>
				</label>
				<button
					type="button"
					className="menu__settings-button"
					onClick={() => setSettingsOpen(true)}
					aria-label="Open settings"
				>
					⚙ Settings
				</button>
			</div>
			<section className="lesson-hero" aria-labelledby="lesson-hero-title">
				<div className="lesson-hero__content">
					<h1 id="lesson-hero-title">{language.label} through tiny stories</h1>
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
				language={language}
				savedStories={savedStories}
				savesError={savesError}
				onResume={onResume}
				onDelete={onDelete}
			/>
		</div>
	);
}
