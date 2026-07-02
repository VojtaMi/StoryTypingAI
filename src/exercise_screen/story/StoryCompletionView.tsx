import type React from "react";
import { useRef, useState } from "react";
import type { StorySegment } from "../types";
import { StoryFeedbackForm } from "./StoryFeedbackForm";

interface StoryCompletionViewProps {
	storyId: string | null;
	currentImageUrl: string | null;
	readingTotalParts: number | null;
	segments: StorySegment[];
	canShowGallery: boolean;
	onOpenGallery: () => void;
	onSubmitStoryFeedback: (feedback: string) => void;
}

export function StoryCompletionView({
	storyId,
	currentImageUrl,
	readingTotalParts,
	segments,
	canShowGallery,
	onOpenGallery,
	onSubmitStoryFeedback,
}: StoryCompletionViewProps) {
	const [playing, setPlaying] = useState(false);
	const playTokenRef = useRef(0);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const aiSegments = segments.filter((segment) => segment.author === "ai");
	const playableUrls = aiSegments
		.map((segment) => segment.narrationAudio?.openingAudioUrl)
		.filter((url): url is string => Boolean(url));

	async function playStoryAgain() {
		if (playing || playableUrls.length === 0) return;
		const token = playTokenRef.current + 1;
		playTokenRef.current = token;
		setPlaying(true);
		try {
			for (const url of playableUrls) {
				if (playTokenRef.current !== token) return;
				await playAudio(url, audioRef);
			}
		} finally {
			audioRef.current = null;
			if (playTokenRef.current === token) setPlaying(false);
		}
	}

	function stopPlayback() {
		playTokenRef.current += 1;
		audioRef.current?.pause();
		audioRef.current = null;
		setPlaying(false);
	}

	return (
		<div className="story__reading story__reading--finished story-completion">
			<div className="story__reading-header">
				{readingTotalParts !== null && (
					<p className="story__reading-progress">
						Part {readingTotalParts} of {readingTotalParts}
					</p>
				)}
			</div>
			<p className="story-completion__eyebrow">Story complete</p>
			<h2 className="story-completion__title">Congratulations</h2>
			<p className="story-completion__lede">You finished the whole story.</p>

			<div className="story-completion__actions">
				<button
					type="button"
					className="story__reading-next"
					disabled={playableUrls.length === 0}
					onClick={playing ? stopPlayback : playStoryAgain}
				>
					{playing ? "Stop playback" : "Play story again"}
				</button>
				{canShowGallery && (
					<button
						type="button"
						className="story-completion__gallery"
						onClick={onOpenGallery}
					>
						Review gallery
					</button>
				)}
			</div>

			{canShowGallery && currentImageUrl && (
				<button
					type="button"
					className="story-completion__preview"
					onClick={onOpenGallery}
					aria-label="Review story image gallery"
				>
					<img src={currentImageUrl} alt="Latest story scene" />
				</button>
			)}

			<StoryFeedbackForm key={storyId} onSubmit={onSubmitStoryFeedback} />
		</div>
	);
}

function playAudio(
	url: string,
	audioRef: React.MutableRefObject<HTMLAudioElement | null>,
) {
	return new Promise<void>((resolve) => {
		const audio = new Audio(url);
		audioRef.current = audio;
		audio.addEventListener("ended", () => resolve(), { once: true });
		audio.addEventListener("error", () => resolve(), { once: true });
		audio.play().catch(() => resolve());
	});
}
