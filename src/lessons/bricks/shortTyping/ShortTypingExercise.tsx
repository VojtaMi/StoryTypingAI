import { useState } from "react";
import { SpanishChatModal } from "../../../exercise_screen/chatbot/SpanishChatModal";
import "../../lesson.css";
import {
	TypingPracticeCard,
	type TypingPracticePrompt,
} from "../typing/TypingPracticeCard";

interface ShortTypingExerciseProps {
	title: string;
	hint: string;
	prompts: TypingPracticePrompt[];
	backgroundIntro?: string;
	completeLabel?: string;
	onComplete: () => void;
	onBack: () => void;
}

export default function ShortTypingExercise({
	title,
	hint,
	prompts,
	backgroundIntro,
	completeLabel = "Continue →",
	onComplete,
	onBack,
}: ShortTypingExerciseProps) {
	const [chatOpen, setChatOpen] = useState(false);

	return (
		<div className="lesson-page short-typing-page">
			<TypingPracticeCard
				title={title}
				hint={hint}
				prompts={prompts}
				completeLabel={completeLabel}
				onComplete={onComplete}
				onBack={onBack}
			/>

			{backgroundIntro && (
				<SpanishChatModal
					isOpen={chatOpen}
					onOpen={() => setChatOpen(true)}
					segments={[]}
					currentTarget={null}
					backgroundIntro={backgroundIntro}
					onClose={() => setChatOpen(false)}
				/>
			)}
		</div>
	);
}
