import type { Genre } from "../../genres";
import { genres } from "../../genres";
import { NewStoryButton } from "./NewStoryButton";

interface NewStoryGridProps {
	onSelect: (genre: Genre) => void;
}

export function NewStoryGrid({ onSelect }: NewStoryGridProps) {
	return (
		<>
			<p className="menu__prompt">Choose a genre to begin your story</p>
			<div className="menu__grid">
				{genres.map((genre) => (
					<NewStoryButton key={genre.id} genre={genre} onSelect={onSelect} />
				))}
			</div>
		</>
	);
}
