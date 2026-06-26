import type { Genre } from "../genres";
import { genres } from "../genres";
import { ModelSelector } from "../modelSelection/ModelSelector";
import type { TextModelId } from "../models";
import type { SavedStorySummary } from "../saves";
import "./menu.css";
import { SavedStories } from "./savedStories/SavedStories";

interface MainMenuProps {
	savedStories: SavedStorySummary[];
	savesError: string | null;
	model: TextModelId;
	hasLessonProgress: boolean;
	onModelChange: (id: TextModelId) => void;
	onSelect: (genre: Genre) => void;
	onStartLesson: () => void;
	onResume: (id: string) => void;
	onDelete: (id: string) => void;
}

export default function MainMenu({
	savedStories,
	savesError,
	model,
	hasLessonProgress,
	onModelChange,
	onSelect,
	onStartLesson,
	onResume,
	onDelete,
}: MainMenuProps) {
	const lessonGenre =
		genres.find((genre) => genre.id === "esperanto") ?? genres[0];
	const lessonSaves = savedStories.filter(
		(story) => story.genreId === "esperanto",
	);

	return (
		<div className="menu">
			<section className="lesson-hero" aria-labelledby="lesson-hero-title">
				<div className="lesson-hero__content">
					<h1 id="lesson-hero-title">Esperanto through tiny stories</h1>
					<div className="lesson-hero__actions">
						<button
							type="button"
							className="lesson-hero__start"
							onClick={onStartLesson}
						>
							{hasLessonProgress ? "Continue Lesson" : "Start Lesson"}
						</button>
						<button
							type="button"
							className="lesson-hero__start lesson-hero__start--secondary"
							onClick={() => onSelect(lessonGenre)}
						>
							New Story
						</button>
					</div>
				</div>
			</section>
			<ModelSelector model={model} onModelChange={onModelChange} />
			<SavedStories
				savedStories={lessonSaves}
				savesError={savesError}
				onResume={onResume}
				onDelete={onDelete}
			/>
		</div>
	);
}
