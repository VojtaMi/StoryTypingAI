import { useEffect, useRef, useState } from "react";
import { getWordAudioUrl } from "../ai";
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
	wordTranslations: Record<string, string> | null;
	onRegenerateWord: (word: string) => Promise<string | null>;
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
	onRegenerateWord,
	onTypingComplete,
	onSubmitContinuation,
	onAutoContinue,
	onBackToMenu,
}: ExerciseScreenProps) {
	const [galleryOpen, setGalleryOpen] = useState(false);
	const [chatOpen, setChatOpen] = useState(false);
	const [popover, setPopover] = useState<WordPopover | null>(null);
	const [regenerating, setRegenerating] = useState(false);
	const popoverRef = useRef<HTMLDivElement>(null);

	const canShowGallery =
		Boolean(storyId) &&
		Boolean(currentImageUrl?.startsWith("/api/story-images/"));

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

	const handleWordClick = (
		token: string,
		translation: string,
		e: React.MouseEvent<HTMLButtonElement>,
	) => {
		getWordAudioUrl(token.toLowerCase())
			.then((url) => new Audio(url).play())
			.catch(() => {
				const utt = new SpeechSynthesisUtterance(token);
				utt.lang = "eo";
				speechSynthesis.cancel();
				speechSynthesis.speak(utt);
			});

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
			const updated = await onRegenerateWord(popover.word);
			if (updated) setPopover((p) => p && { ...p, translation: updated });
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
