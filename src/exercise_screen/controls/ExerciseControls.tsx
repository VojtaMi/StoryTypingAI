import { GalleryButton } from "../../gallery/GalleryButton";

interface ExerciseControlsProps {
	storyId: string | null;
	currentImageUrl: string | null;
	onBackToMenu: () => void;
	onOpenGallery: () => void;
}

export function ExerciseControls({
	storyId,
	currentImageUrl,
	onBackToMenu,
	onOpenGallery,
}: ExerciseControlsProps) {
	const canOpenGallery =
		Boolean(storyId) &&
		Boolean(currentImageUrl?.startsWith("/api/story-images/"));

	return (
		<div className="controls">
			<button type="button" onClick={onBackToMenu}>
				← Back to menu
			</button>
			{canOpenGallery && <GalleryButton onClick={onOpenGallery} />}
		</div>
	);
}
