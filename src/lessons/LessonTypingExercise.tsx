import { useCallback, useEffect, useRef, useState } from "react";
import { TypingPassage } from "../exercise_screen/typing/TypingPassage";
import { useTypingSession } from "../exercise_screen/typing/useTypingSession";
import "./lesson.css";
import { audioUrlCache, ensureLessonAudioUrl } from "./lessonAudio";

interface LessonTypingExerciseProps {
	lessonId: string;
	text: string;
	imageUrl: string;
	onComplete: () => void;
	onBack: () => void;
}

export default function LessonTypingExercise({
	lessonId,
	text,
	imageUrl,
	onComplete,
	onBack,
}: LessonTypingExerciseProps) {
	const [done, setDone] = useState(false);
	const session = useTypingSession(text, () => setDone(true), {
		requireAllCorrect: true,
	});

	const audioRef = useRef<HTMLAudioElement | null>(null);

	const playAudio = useCallback(() => {
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current = null;
		}
		const run = (url: string) => {
			const audio = new Audio(url);
			audioRef.current = audio;
			audio.addEventListener("ended", () => {
				audioRef.current = null;
			});
			audio.play().catch(() => {
				audioRef.current = null;
			});
		};
		const cached = audioUrlCache.get(text);
		if (cached) {
			run(cached);
		} else {
			ensureLessonAudioUrl(lessonId, text)
				.then(run)
				.catch(() => {});
		}
	}, [lessonId, text]);

	useEffect(() => {
		playAudio();
		return () => {
			audioRef.current?.pause();
		};
	}, [playAudio]);

	return (
		<div className="lesson-typing-page">
			<div
				className="lesson-typing-bg"
				style={{
					backgroundImage: `linear-gradient(rgba(10,12,18,0.45), rgba(10,12,18,0.65)), url(${imageUrl})`,
				}}
			/>
			<div className="lesson-typing-card">
				<button
					type="button"
					className="lesson-doc__back lesson-doc__back--light"
					onClick={onBack}
				>
					← Back
				</button>

				<p className="lesson-doc__eyebrow">Exercise</p>
				<h1 className="lesson-typing__title">Typing Practice</h1>
				<p className="lesson-typing__hint">
					type what you see
					<button
						type="button"
						className="lesson-typing__replay"
						onClick={playAudio}
						aria-label="Replay audio"
					>
						🔊
					</button>
				</p>

				<div className="lesson-typing__passage">
					<TypingPassage
						target={text}
						typedValue={session.typedValue}
						statuses={session.statuses}
						inputRef={session.inputRef}
						onChange={session.handleChange}
						onKeyDown={session.handleKeyDown}
					/>
				</div>

				{done && (
					<div className="lesson-typing__done">
						<p className="lesson-typing__done-msg">Well done!</p>
						<button
							type="button"
							className="lesson-doc__begin"
							onClick={onComplete}
						>
							Continue →
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
