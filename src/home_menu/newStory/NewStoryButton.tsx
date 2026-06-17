import type { CSSProperties } from "react";
import type { Genre } from "../../genres";

interface NewStoryButtonProps {
	genre: Genre;
	onSelect: (genre: Genre) => void;
}

export function NewStoryButton({ genre, onSelect }: NewStoryButtonProps) {
	return (
		<button
			type="button"
			className="genre-circle"
			style={
				{
					"--genre-color": genre.color,
					"--genre-image": `url(/images/fallback-${genre.id}.webp)`,
				} as CSSProperties
			}
			onClick={() => onSelect(genre)}
		>
			<span className="genre-circle__label">{genre.label}</span>
		</button>
	);
}
