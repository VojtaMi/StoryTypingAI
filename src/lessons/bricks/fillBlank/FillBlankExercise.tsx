import { useState } from "react";
import { SpanishChatModal } from "../../../exercise_screen/chatbot/SpanishChatModal";
import "../../lesson.css";
import { useChoicePrompt } from "../../useChoicePrompt";
import type { FillBlankPrompt } from "./index";

interface FillBlankExerciseProps {
	title: string;
	hint: string;
	prompts: FillBlankPrompt[];
	backgroundIntro?: string;
	completeLabel?: string;
	onComplete: () => void;
	onBack: () => void;
}

function Prompt({
	prompt,
	solved,
	onSolved,
}: {
	prompt: FillBlankPrompt;
	solved: boolean;
	onSolved: () => void;
}) {
	const { shuffledChoices, wrongChoice, choose } = useChoicePrompt(
		prompt.choices,
		prompt.answer,
		onSolved,
	);

	return (
		<>
			<p className="fill-blank__sentence">
				{prompt.before}
				<span
					className={`fill-blank__blank${solved ? " fill-blank__blank--filled" : ""}`}
				>
					{solved ? prompt.answer : "_____"}
				</span>
				{prompt.after}
			</p>
			<p className="lesson-highlight fill-blank__meaning">{prompt.meaning}</p>

			<div className="word-match__col fill-blank__choices">
				{shuffledChoices.map((choice) => (
					<button
						key={choice}
						type="button"
						className={[
							"lesson-choice",
							"word-match__item",
							solved && choice === prompt.answer && "lesson-choice--correct",
							wrongChoice === choice && "lesson-choice--wrong",
						]
							.filter(Boolean)
							.join(" ")}
						disabled={solved}
						onClick={() => choose(choice)}
					>
						{choice}
					</button>
				))}
			</div>
		</>
	);
}

export default function FillBlankExercise({
	title,
	hint,
	prompts,
	backgroundIntro,
	completeLabel = "Continue →",
	onComplete,
	onBack,
}: FillBlankExerciseProps) {
	const [promptIndex, setPromptIndex] = useState(0);
	const [solved, setSolved] = useState(false);
	const [chatOpen, setChatOpen] = useState(false);

	const prompt = prompts[promptIndex];
	const isLast = promptIndex === prompts.length - 1;

	function nextPrompt() {
		if (isLast) {
			onComplete();
			return;
		}
		setSolved(false);
		setPromptIndex(promptIndex + 1);
	}

	return (
		<div className="lesson-page">
			<div className="lesson-doc fill-blank">
				<button type="button" className="lesson-doc__back" onClick={onBack}>
					← Back to lessons
				</button>

				<p className="lesson-doc__eyebrow">
					Exercise {promptIndex + 1} / {prompts.length}
				</p>
				<h1 className="lesson-exercise__title">{title}</h1>
				<p className="lesson-exercise__hint">{hint}</p>

				<Prompt
					// Remount per prompt so the choice shuffle and wrong-flash reset.
					key={prompt.id}
					prompt={prompt}
					solved={solved}
					onSolved={() => setSolved(true)}
				/>

				<div className="lesson-exercise__actions fill-blank__actions">
					{solved && (
						<button
							type="button"
							className="lesson-doc__begin"
							onClick={nextPrompt}
						>
							{isLast ? completeLabel : "Next →"}
						</button>
					)}
				</div>
			</div>

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
