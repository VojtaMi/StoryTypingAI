import { useState } from "react";
import "./gallery/gallery.css";
import { GalleryButton } from "./gallery/GalleryButton";
import { GalleryModal } from "./gallery/GalleryModal";
import TypingExercise, { type TypingStats } from "./TypingExercise";

export interface StorySegment {
	id: number;
	author: "ai" | "user";
	text: string;
}

export type StoryPhase = "typing" | "authoring" | "loading";

interface StoryViewProps {
	segments: StorySegment[];
	currentTarget: string | null;
	phase: StoryPhase;
	error: string | null;
	backgroundIntro?: string;
	storyId: string | null;
	currentImageUrl: string | null;
	onTypingComplete: (stats: TypingStats) => void;
	onSubmitContinuation: (text: string) => void;
	onBackToMenu: () => void;
}

export default function StoryView({
	segments,
	currentTarget,
	phase,
	error,
	backgroundIntro,
	storyId,
	currentImageUrl,
	onTypingComplete,
	onSubmitContinuation,
	onBackToMenu,
}: StoryViewProps) {
	const [draft, setDraft] = useState("");
	const [galleryOpen, setGalleryOpen] = useState(false);

	function submit() {
		const text = draft.trim();
		if (!text) return;
		setDraft("");
		onSubmitContinuation(text);
	}

	return (
		<div className="story">
			{backgroundIntro && <p className="story__intro">{backgroundIntro}</p>}

			{segments.length > 0 && (
				<div className="story__log">
					{segments.map((segment) => (
						<p
							key={segment.id}
							className={`segment segment--${segment.author}`}
						>
							{segment.text}
						</p>
					))}
				</div>
			)}

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
				<div className="authoring">
					<p className="story__hint">Now write your own continuation:</p>
					<textarea
						className="authoring__input"
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
						}}
						placeholder="What happens next? (Ctrl/Cmd+Enter to send)"
						rows={4}
					/>
					<button
						type="button"
						className="authoring__submit"
						onClick={submit}
						disabled={!draft.trim()}
					>
						Continue story
					</button>
				</div>
			)}

			{phase === "loading" && <p className="loading">The story unfolds…</p>}

			{error && <p className="story__error">{error}</p>}

			<div className="controls">
				<button type="button" onClick={onBackToMenu}>
					← Back to menu
				</button>
				{storyId && currentImageUrl?.startsWith("/api/story-images/") && (
					<GalleryButton onClick={() => setGalleryOpen(true)} />
				)}
			</div>

			{galleryOpen &&
				storyId &&
				currentImageUrl?.startsWith("/api/story-images/") && (
					<GalleryModal
						storyId={storyId}
						currentImageUrl={currentImageUrl}
						onClose={() => setGalleryOpen(false)}
					/>
				)}
		</div>
	);
}
