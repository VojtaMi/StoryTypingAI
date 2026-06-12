import { type Genre, genres } from "./genres";
import type { SavedStorySummary } from "./saves";

interface MenuProps {
	savedStories: SavedStorySummary[];
	savesError: string | null;
	onSelect: (genre: Genre) => void;
	onResume: (id: string) => void;
	onDelete: (id: string) => void;
}

export default function Menu({
	savedStories,
	savesError,
	onSelect,
	onResume,
	onDelete,
}: MenuProps) {
	return (
		<div className="menu">
			<p className="menu__prompt">Choose a genre to begin your story</p>
			<div className="menu__grid">
				{genres.map((genre) => (
					<button
						key={genre.id}
						type="button"
						className="genre-circle"
						style={{ "--genre-color": genre.color } as React.CSSProperties}
						onClick={() => onSelect(genre)}
					>
						<span className="genre-circle__emoji" aria-hidden="true">
							{genre.emoji}
						</span>
						<span className="genre-circle__label">{genre.label}</span>
					</button>
				))}
			</div>

			<section className="saved-stories" aria-labelledby="saved-stories-title">
				<h2 id="saved-stories-title">Saved stories</h2>
				{savesError && <p className="story__error">{savesError}</p>}
				{savedStories.length === 0 ? (
					<p className="saved-stories__empty">
						Your local story files will appear here.
					</p>
				) : (
					<div className="saved-stories__list">
						{savedStories.map((story) => {
							const storyGenre = genres.find(
								(genre) => genre.id === story.genreId,
							);
							return (
								<article key={story.id} className="saved-story">
									<div>
										<h3>{story.title}</h3>
										<p className="saved-story__meta">
											{storyGenre?.emoji} {storyGenre?.label ?? story.genreId} ·{" "}
											{formatDate(story.updatedAt)}
										</p>
										{story.preview && (
											<p className="saved-story__preview">{story.preview}</p>
										)}
									</div>
									<div className="saved-story__actions">
										<button type="button" onClick={() => onResume(story.id)}>
											Resume
										</button>
										<button
											type="button"
											className="saved-story__delete"
											onClick={() => onDelete(story.id)}
										>
											Delete
										</button>
									</div>
								</article>
							);
						})}
					</div>
				)}
			</section>
		</div>
	);
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}
