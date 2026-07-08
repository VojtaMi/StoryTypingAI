import { useCallback, useEffect, useState } from "react";
import { EsperantoChatModal } from "../../../exercise_screen/chatbot/EsperantoChatModal";
import { TypingPassage } from "../../../exercise_screen/typing/TypingPassage";
import { useTypingSession } from "../../../exercise_screen/typing/useTypingSession";
import "../../lesson.css";
import { useLessonTextAudioPlayer } from "../../lessonAudio";

interface LessonTypingExerciseProps {
	lessonId: string;
	text: string;
	imageUrl: string;
	/** Describes the scene for anyone who cannot see it. */
	imageAlt?: string;
	backgroundIntro?: string;
	onComplete: () => void;
	onBack: () => void;
}

export default function LessonTypingExercise({
	lessonId,
	text,
	imageUrl,
	imageAlt,
	backgroundIntro,
	onComplete,
	onBack,
}: LessonTypingExerciseProps) {
	const [done, setDone] = useState(false);
	const [chatOpen, setChatOpen] = useState(false);
	const session = useTypingSession(text, () => setDone(true), {
		requireAllCorrect: true,
	});

	const { play } = useLessonTextAudioPlayer(lessonId);

	const playAudio = useCallback(() => {
		play(text);
	}, [play, text]);

	useEffect(() => {
		playAudio();
	}, [playAudio]);

	return (
		<div className="lesson-typing-page">
			<div
				className="lesson-typing-bg"
				{...(imageAlt ? { role: "img", "aria-label": imageAlt } : {})}
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
					← Back to lessons
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

			{backgroundIntro && (
				<EsperantoChatModal
					isOpen={chatOpen}
					onOpen={() => setChatOpen(true)}
					segments={[]}
					currentTarget={text}
					backgroundIntro={backgroundIntro}
					onClose={() => setChatOpen(false)}
				/>
			)}
		</div>
	);
}
