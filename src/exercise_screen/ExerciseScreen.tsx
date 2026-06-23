import { useState } from "react";
import "../gallery/gallery.css";
import { GalleryModal } from "../gallery/GalleryModal";
import type { TextModelId } from "../models";
import { AuthoringInput } from "./authoring/AuthoringInput";
import { EsperantoChatModal } from "./chatbot/EsperantoChatModal";
import { ExerciseControls } from "./controls/ExerciseControls";
import { OpeningAudioControl } from "./story/OpeningAudioControl";
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
	model: TextModelId;
	currentImageUrl: string | null;
	openingAudioUrl: string | null;
	onTypingComplete: (stats: TypingStats) => void;
	onSubmitContinuation: (text: string) => void;
	onAutoContinue: () => void;
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
	model,
	currentImageUrl,
	openingAudioUrl,
	onTypingComplete,
	onSubmitContinuation,
	onAutoContinue,
	onBackToMenu,
}: ExerciseScreenProps) {
	const [galleryOpen, setGalleryOpen] = useState(false);
	const [chatOpen, setChatOpen] = useState(false);
	const canShowGallery =
		Boolean(storyId) &&
		Boolean(currentImageUrl?.startsWith("/api/story-images/"));

	return (
		<div className="story">
			{backgroundIntro && <p className="story__intro">{backgroundIntro}</p>}

			<StoryLog segments={segments} />

			{phase === "typing" && currentTarget && (
				<div className="story__current">
					<div className="story__current-header">
						<p className="story__hint">Type the next part of the story:</p>
						<OpeningAudioControl audioUrl={openingAudioUrl} />
					</div>
					<TypingExercise
						key={segments.length}
						target={currentTarget}
						onComplete={onTypingComplete}
					/>
				</div>
			)}

			{phase === "authoring" && (
				<AuthoringInput
					onSubmit={onSubmitContinuation}
					onAutoContinue={onAutoContinue}
				/>
			)}

			{phase === "loading" && (
				<StoryLoading streamingTarget={streamingTarget} />
			)}

			{error && <p className="story__error">{error}</p>}

			<ExerciseControls
				storyId={storyId}
				currentImageUrl={currentImageUrl}
				onBackToMenu={onBackToMenu}
				onOpenChat={() => setChatOpen(true)}
				onOpenGallery={() => setGalleryOpen(true)}
			/>

			<EsperantoChatModal
				isOpen={chatOpen}
				segments={segments}
				currentTarget={currentTarget}
				backgroundIntro={backgroundIntro}
				model={model}
				onClose={() => setChatOpen(false)}
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
