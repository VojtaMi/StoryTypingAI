import { useState } from "react";
import "../gallery/gallery.css";
import { GalleryModal } from "../gallery/GalleryModal";
import { AuthoringInput } from "./authoring/AuthoringInput";
import { ExerciseControls } from "./controls/ExerciseControls";
import { StoryLoading } from "./story/StoryLoading";
import { StoryLog } from "./story/StoryLog";
import type { StoryPhase, StorySegment, TypingStats } from "./types";
import { TypingExercise } from "./typing/TypingExercise";

interface ExerciseScreenProps {
	segments: StorySegment[];
	currentTarget: string | null;
	streamingTarget: string;
	phase: StoryPhase;
	error: string | null;
	backgroundIntro?: string;
	storyId: string | null;
	currentImageUrl: string | null;
	onTypingComplete: (stats: TypingStats) => void;
	onSubmitContinuation: (text: string) => void;
	onBackToMenu: () => void;
}

export default function ExerciseScreen({
	segments,
	currentTarget,
	streamingTarget,
	phase,
	error,
	backgroundIntro,
	storyId,
	currentImageUrl,
	onTypingComplete,
	onSubmitContinuation,
	onBackToMenu,
}: ExerciseScreenProps) {
	const [galleryOpen, setGalleryOpen] = useState(false);
	const canShowGallery =
		Boolean(storyId) &&
		Boolean(currentImageUrl?.startsWith("/api/story-images/"));

	return (
		<div className="story">
			{backgroundIntro && <p className="story__intro">{backgroundIntro}</p>}

			<StoryLog segments={segments} />

			{phase === "typing" && currentTarget && (
				<div className="story__current">
					<p className="story__hint">Type the next part of the story:</p>
					<TypingExercise
						key={segments.length}
						target={currentTarget}
						onComplete={onTypingComplete}
					/>
				</div>
			)}

			{phase === "authoring" && (
				<AuthoringInput onSubmit={onSubmitContinuation} />
			)}

			{phase === "loading" && (
				<StoryLoading streamingTarget={streamingTarget} />
			)}

			{error && <p className="story__error">{error}</p>}

			<ExerciseControls
				storyId={storyId}
				currentImageUrl={currentImageUrl}
				onBackToMenu={onBackToMenu}
				onOpenGallery={() => setGalleryOpen(true)}
			/>

			{galleryOpen && canShowGallery && storyId && currentImageUrl && (
				<GalleryModal
					storyId={storyId}
					currentImageUrl={currentImageUrl}
					onClose={() => setGalleryOpen(false)}
				/>
			)}
		</div>
	);
}
