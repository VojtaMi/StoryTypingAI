import type { SavedStorySummary } from "../../saves";
import { SavedStoryPreview } from "./SavedStoryPreview";

interface SavedStoriesProps {
	savedStories: SavedStorySummary[];
	savesError: string | null;
	onResume: (id: string) => void;
	onDelete: (id: string) => void;
}

export function SavedStories({
	savedStories,
	savesError,
	onResume,
	onDelete,
}: SavedStoriesProps) {
	return (
		<section className="saved-stories" aria-labelledby="saved-stories-title">
			<h2 id="saved-stories-title">Saved lessons</h2>
			{savesError && <p className="story__error">{savesError}</p>}
			{savedStories.length === 0 ? (
				<p className="saved-stories__empty">
					Your Esperanto lesson saves will appear here.
				</p>
			) : (
				<div className="saved-stories__list">
					{savedStories.map((story) => (
						<SavedStoryPreview
							key={story.id}
							story={story}
							onResume={onResume}
							onDelete={onDelete}
						/>
					))}
				</div>
			)}
		</section>
	);
}
