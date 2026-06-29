import { useState } from "react";
import "../gallery/gallery.css";
import { GalleryModal } from "../gallery/GalleryModal";
import { AuthoringInput } from "./authoring/AuthoringInput";
import { EsperantoChatModal } from "./chatbot/EsperantoChatModal";
import { ExerciseControls } from "./controls/ExerciseControls";
import { OpeningAudioControl } from "./story/OpeningAudioControl";
import { StoryLoading } from "./story/StoryLoading";
import { StoryLog } from "./story/StoryLog";
import type { StoryPhase, StorySegment, TypingStats } from "./types";
import { TypingExercise } from "./typing/TypingExercise";

const WORD_PATTERN = /([a-zA-ZĉĝĥĵŝŭĈĜĤĴŜŬ]+|[^a-zA-ZĉĝĥĵŝŭĈĜĤĴŜŬ]+)/g;

interface ExerciseScreenProps {
	segments: StorySegment[];
	currentTarget: string | null;
	streamingTarget: string;
	phase: StoryPhase;
	error: string | null;
	backgroundIntro?: string;
	storyId: string | null;
	currentImageUrl: string | null;
	openingAudioUrl: string | null;
	wordTranslations: Record<string, string> | null;
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
	currentImageUrl,
	openingAudioUrl,
	wordTranslations,
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

			{phase === "reading" && currentTarget && (
				<div className="story__reading">
					<div className="story__reading-header">
						<OpeningAudioControl audioUrl={openingAudioUrl} />
					</div>
					<p className="story__reading-text">
						{[...currentTarget.matchAll(WORD_PATTERN)].map((match) => {
							const token = match[1];
							const isWord = /[a-zA-ZĉĝĥĵŝŭĈĜĤĴŜŬ]/.test(token);
							if (!isWord) return token;
							const translation = wordTranslations?.[token.toLowerCase()];
							return (
								<span
									key={match.index}
									className={translation ? "story__word" : undefined}
									data-translation={translation}
								>
									{token}
								</span>
							);
						})}
					</p>
				</div>
			)}

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
				onOpenGallery={() => setGalleryOpen(true)}
			/>

			<EsperantoChatModal
				isOpen={chatOpen}
				onOpen={() => setChatOpen(true)}
				segments={segments}
				currentTarget={currentTarget}
				backgroundIntro={backgroundIntro}
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
