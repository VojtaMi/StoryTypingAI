import { useEffect, useRef, useState } from "react";
import {
	getWordAudioUrl,
	logLearnerWordClick,
	regenerateWordAudioUrl,
} from "../ai";
import "../gallery/gallery.css";
import { GalleryModal } from "../gallery/GalleryModal";
import type { StoryRecapExerciseResult, StoryRecapLesson } from "../storyRecap";
import { isStoryName } from "../storyVocabulary";
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
	isName: boolean;
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
	openingAudioLoading?: boolean;
	openingAudioError?: boolean;
	onRetryOpeningAudio?: () => void;
	readingPartIndex: number | null;
	readingTotalParts: number | null;
	storyFeedbackSubmittedAt: string | null;
	storyFeedback: string | null;
	feedbackEditable: boolean;
	wordTranslations: Record<string, string> | null;
	nonTranslatableWords: string[];
	storyRecapLesson: StoryRecapLesson | null;
	storyRecapError: string | null;
	onRegenerateWord: (word: string) => Promise<string | null>;
	onContinueReading: () => void;
	onCompleteStoryRecap: (results: StoryRecapExerciseResult[]) => void;
	onRetryStoryRecap: () => void;
	onSkipStoryRecap: () => void;
	onTypingComplete: (stats: TypingStats) => void;
	onSubmitContinuation: (text: string) => void;
	onAutoContinue: () => void;
	onBackToMenu: () => void;
	onSubmitStoryFeedback: (feedback: string, nextStoryTheme: string) => void;
	onStoryFeedbackDraftChange: (
		feedback: string,
		nextStoryTheme: string,
	) => void;
	/** Buffers the learner's tutor questions for the reading-story baseline. */
	onCaptureBotQuestions: (questions: string[]) => void;
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
	openingAudioLoading,
	openingAudioError,
	onRetryOpeningAudio,
	readingPartIndex,
	readingTotalParts,
	storyFeedbackSubmittedAt,
	storyFeedback,
	feedbackEditable,
	wordTranslations,
	nonTranslatableWords,
	storyRecapLesson,
	storyRecapError,
	onRegenerateWord,
	onContinueReading,
	onCompleteStoryRecap,
	onRetryStoryRecap,
	onSkipStoryRecap,
	onTypingComplete,
	onSubmitContinuation,
	onAutoContinue,
	onBackToMenu,
	onSubmitStoryFeedback,
	onStoryFeedbackDraftChange,
	onCaptureBotQuestions,
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
		isName: boolean,
		e: React.MouseEvent<HTMLButtonElement>,
	) => {
		// Word popovers only appear while reading, so every lookup here belongs to
		// this story — scope it so the story's baseline (not the global cursor)
		// folds it and no other story can consume it.
		void logLearnerWordClick(token, storyId ?? undefined);
		playWordAudio(token);

		const rect = e.currentTarget.getBoundingClientRect();
		setPopover({
			word: token.toLowerCase(),
			translation,
			isName,
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
					</div>
					<p className="story__reading-text">
						{[...currentTarget.matchAll(WORD_PATTERN)].map((match) => {
							const token = match[1];
							const isWord = /[a-zA-ZĉĝĥĵŝŭĈĜĤĴŜŬ]/.test(token);
							if (!isWord) return token;
							const isName = isStoryName(token, nonTranslatableWords);
							const translation = isName
								? "(name)"
								: wordTranslations?.[token.toLowerCase()];
							return translation ? (
								<button
									key={match.index}
									type="button"
									className="story__word"
									onClick={(e) =>
										handleWordClick(token, translation, isName, e)
									}
								>
									{token}
								</button>
							) : (
								<span key={match.index}>{token}</span>
							);
						})}
					</p>
					<OpeningAudioControl
						audioUrl={openingAudioUrl}
						isLoading={openingAudioLoading}
						hasError={openingAudioError}
						onRetry={onRetryOpeningAudio}
					/>
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
					feedbackEditable={feedbackEditable}
					priorFeedback={storyFeedback}
					canShowGallery={canShowGallery}
					onOpenGallery={() => setGalleryOpen(true)}
					onSubmitStoryFeedback={onSubmitStoryFeedback}
					onStoryFeedbackDraftChange={onStoryFeedbackDraftChange}
				/>
			)}

			{phase === "typing" && currentTarget && (
				<div className="story__current">
					<div className="story__current-header">
						<p className="story__hint">Type the next part of the story:</p>
					</div>
					<TypingExercise
						key={segments.length}
						target={currentTarget}
						onComplete={onTypingComplete}
					/>
					<OpeningAudioControl audioUrl={openingAudioUrl} />
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
					{!popover.isName && (
						<button
							type="button"
							className="story__word-popover__regenerate"
							title="Regenerate translation"
							disabled={regenerating}
							onClick={handleRegenerate}
						>
							↺
						</button>
					)}
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
				// Reading stories buffer questions for the finish baseline; typing
				// stories (no baseline) keep the immediate per-close refine.
				onCaptureQuestions={
					readingTotalParts !== null ? onCaptureBotQuestions : undefined
				}
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
