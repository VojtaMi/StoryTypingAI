import { GalleryButton } from "../../gallery/GalleryButton";
import { EsperantoChatButton } from "../chatbot/EsperantoChatButton";

interface ExerciseControlsProps {
	storyId: string | null;
	currentImageUrl: string | null;
	onBackToMenu: () => void;
	onOpenChat: () => void;
	onOpenGallery: () => void;
}

export function ExerciseControls({
	storyId,
	currentImageUrl,
	onBackToMenu,
	onOpenChat,
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
			<EsperantoChatButton onClick={onOpenChat} />
			{canOpenGallery && <GalleryButton onClick={onOpenGallery} />}
		</div>
	);
}
