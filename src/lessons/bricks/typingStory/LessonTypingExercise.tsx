import { useCallback, useEffect, useState } from "react";
import { EsperantoChatModal } from "../../../exercise_screen/chatbot/EsperantoChatModal";
import "../../lesson.css";
import { useLessonTextAudioPlayer } from "../../lessonAudio";
import { TypingPracticeCard } from "../typing/TypingPracticeCard";

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
	const [chatOpen, setChatOpen] = useState(false);
	const { play } = useLessonTextAudioPlayer(lessonId);

	const playAudio = useCallback(() => {
		play(text);
	}, [play, text]);

	useEffect(() => {
		playAudio();
	}, [playAudio]);

	return (
		<div className="lesson-theme lesson-typing-page">
			<div
				className="lesson-typing-bg"
				{...(imageAlt ? { role: "img", "aria-label": imageAlt } : {})}
				style={{
					backgroundImage: `linear-gradient(rgba(10,12,18,0.45), rgba(10,12,18,0.65)), url(${imageUrl})`,
				}}
			/>
			<TypingPracticeCard
				title="Typing Practice"
				hint="type what you see"
				prompts={[{ id: "story", target: text }]}
				onReplay={playAudio}
				onComplete={onComplete}
				onBack={onBack}
			/>

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
