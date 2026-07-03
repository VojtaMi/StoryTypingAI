import { useEffect, useRef, useState } from "react";
import {
	getWordAudioUrl,
	logLearnerWordClick,
	regenerateWordAudioUrl,
} from "../ai";
import "../gallery/gallery.css";
import { GalleryModal } from "../gallery/GalleryModal";
import type { StoryRecapLesson } from "../storyRecap";
import { AuthoringInput } from "./authoring/AuthoringInput";
import { EsperantoChatModal } from "./chatbot/EsperantoChatModal";
import { ExerciseControls } from "./controls/ExerciseControls";
import { OpeningAudioControl } from "./story/OpeningAudioControl";
import { StoryCompletionView } from "./story/StoryCompletionView";
import { StoryLoading } from "./story/StoryLoading";
import { StoryLog } from "./story/StoryLog";
import { StoryRecapView } from "./story/StoryRecapView";
import type { StoryPhase, StorySegment, TypingStats } from "./types";
import { TypingExercise } from "./typing/TypingExercise";

const WORD_PATTERN = /([a-zA-ZĉĝĥĵŝŭĈĜĤĴŜŬ]+|[^a-zA-ZĉĝĥĵŝŭĈĜĤĴŜŬ]+)/g;

interface WordPopover {
	word: string;
	translation: string;
	x: number;
	y: number;
}

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
	readingPartIndex: number | null;
	readingTotalParts: number | null;
	storyFeedbackSubmittedAt: string | null;
	wordTranslations: Record<string, string> | null;
	storyRecapLesson: StoryRecapLesson | null;
	storyRecapError: string | null;
	onRegenerateWord: (word: string) => Promise<string | null>;
	onContinueReading: () => void;
	onCompleteStoryRecap: () => void;
	onRetryStoryRecap: () => void;
	onSkipStoryRecap: () => void;
	onRestartStory: () => void;
	onTypingComplete: (stats: TypingStats) => void;
	onSubmitContinuation: (text: string) => void;
	onAutoContinue: () => void;
	onBackToMenu: () => void;
	onSubmitStoryFeedback: (feedback: string) => void;
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
	readingPartIndex,
	readingTotalParts,
	storyFeedbackSubmittedAt,
	wordTranslations,
	storyRecapLesson,
	storyRecapError,
	onRegenerateWord,
	onContinueReading,
	onCompleteStoryRecap,
	onRetryStoryRecap,
	onSkipStoryRecap,
	onRestartStory,
	onTypingComplete,
	onSubmitContinuation,
	onAutoContinue,
	onBackToMenu,
	onSubmitStoryFeedback,
}: ExerciseScreenProps) {
	const [galleryOpen, setGalleryOpen] = useState(false);
	const [chatOpen, setChatOpen] = useState(false);
	const [popover, setPopover] = useState<WordPopover | null>(null);
	const [regenerating, setRegenerating] = useState(false);
	const [wordAudioUrls, setWordAudioUrls] = useState<Record<string, string>>(
		{},
	);
	const popoverRef = useRef<HTMLDivElement>(null);

	const canShowGallery =
		Boolean(storyId) &&
		Boolean(currentImageUrl?.startsWith("/api/story-images/"));
	const readingProgress =
		readingPartIndex !== null && readingTotalParts !== null
			? `Part ${readingPartIndex} of ${readingTotalParts}`
			: null;
	const canContinueReading =
		phase === "reading" &&
		currentTarget !== null &&
		readingPartIndex !== null &&
		readingTotalParts !== null;

	useEffect(() => {
		if (!popover) return;
		const handler = (e: MouseEvent) => {
			if (!popoverRef.current?.contains(e.target as Node)) {
				setPopover(null);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [popover]);

	const playWordAudio = (word: string, audioUrl?: string) => {
		const normalizedWord = word.toLowerCase();
		const existingUrl = audioUrl ?? wordAudioUrls[normalizedWord];
		(existingUrl
			? Promise.resolve(existingUrl)
			: getWordAudioUrl(normalizedWord)
		)
			.then((url) => {
				if (!existingUrl) {
					setWordAudioUrls((prev) => ({ ...prev, [normalizedWord]: url }));
				}
				return new Audio(url).play();
			})
			.catch(() => {
				const utt = new SpeechSynthesisUtterance(word);
				utt.lang = "eo";
				speechSynthesis.cancel();
				speechSynthesis.speak(utt);
			});
	};

	const handleWordClick = (
		token: string,
		translation: string,
		e: React.MouseEvent<HTMLButtonElement>,
	) => {
		void logLearnerWordClick(token);
		playWordAudio(token);

		const rect = e.currentTarget.getBoundingClientRect();
		setPopover({
			word: token.toLowerCase(),
			translation,
			x: rect.left + rect.width / 2,
			y: rect.top,
		});
	};

	const handleRegenerate = async () => {
		if (!popover || regenerating) return;
		setRegenerating(true);
		try {
			const [updated, audioUrl] = await Promise.all([
				onRegenerateWord(popover.word),
				regenerateWordAudioUrl(popover.word),
			]);
			if (updated) setPopover((p) => p && { ...p, translation: updated });
			setWordAudioUrls((prev) => ({ ...prev, [popover.word]: audioUrl }));
			playWordAudio(popover.word, audioUrl);
		} finally {
			setRegenerating(false);
		}
	};

	return (
		<div className="story">
			{backgroundIntro && <p className="story__intro">{backgroundIntro}</p>}

			<StoryLog segments={segments} />

			{phase === "reading" && currentTarget && (
				<div className="story__reading">
					<div className="story__reading-header">
						{readingProgress && (
							<p className="story__reading-progress">{readingProgress}</p>
						)}
						<OpeningAudioControl audioUrl={openingAudioUrl} />
					</div>
					<p className="story__reading-text">
						{[...currentTarget.matchAll(WORD_PATTERN)].map((match) => {
							const token = match[1];
							const isWord = /[a-zA-ZĉĝĥĵŝŭĈĜĤĴŜŬ]/.test(token);
							if (!isWord) return token;
							const translation = wordTranslations?.[token.toLowerCase()];
							return translation ? (
								<button
									key={match.index}
									type="button"
									className="story__word"
									onClick={(e) => handleWordClick(token, translation, e)}
								>
									{token}
								</button>
							) : (
								<span key={match.index}>{token}</span>
							);
						})}
					</p>
					<div className="story__reading-actions">
						<button
							type="button"
							className="story__reading-next"
							disabled={!canContinueReading}
							onClick={onContinueReading}
						>
							{canContinueReading && readingPartIndex === readingTotalParts
								? "Finish story"
								: "Next part"}
						</button>
					</div>
				</div>
			)}

			{(phase === "recap-loading" || phase === "recap") && (
				<StoryRecapView
					lesson={storyRecapLesson}
					error={storyRecapError}
					onComplete={onCompleteStoryRecap}
					onRetry={onRetryStoryRecap}
					onSkip={onSkipStoryRecap}
				/>
			)}

			{phase === "finished" && (
				<StoryCompletionView
					storyId={storyId}
					currentImageUrl={currentImageUrl}
					readingTotalParts={readingTotalParts}
					storyFeedbackSubmittedAt={storyFeedbackSubmittedAt}
					canShowGallery={canShowGallery}
					onOpenGallery={() => setGalleryOpen(true)}
					onSubmitStoryFeedback={onSubmitStoryFeedback}
					onRestartStory={onRestartStory}
				/>
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

			{popover && (
				<div
					ref={popoverRef}
					className="story__word-popover"
					style={{ left: popover.x, top: popover.y }}
				>
					<span>{popover.translation}</span>
					<button
						type="button"
						className="story__word-popover__regenerate"
						title="Regenerate translation"
						disabled={regenerating}
						onClick={handleRegenerate}
					>
						↺
					</button>
				</div>
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
