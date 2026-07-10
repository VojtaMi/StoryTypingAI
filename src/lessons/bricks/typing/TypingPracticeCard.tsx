import { type ReactNode, useState } from "react";
import { TypingPassage } from "../../../exercise_screen/typing/TypingPassage";
import { useTypingSession } from "../../../exercise_screen/typing/useTypingSession";

export interface TypingPracticePrompt {
	id: string;
	target: string;
	cue?: string;
}

interface TypingPracticeCardProps {
	title: string;
	hint: ReactNode;
	prompts: TypingPracticePrompt[];
	completeLabel?: string;
	onReplay?: () => void;
	onComplete: () => void;
	onBack: () => void;
}

export function TypingPracticeCard({
	title,
	hint,
	prompts,
	completeLabel = "Continue →",
	onReplay,
	onComplete,
	onBack,
}: TypingPracticeCardProps) {
	const [promptIndex, setPromptIndex] = useState(0);
	const [solved, setSolved] = useState(false);
	const prompt = prompts[promptIndex];
	const isLast = promptIndex === prompts.length - 1;
	const session = useTypingSession(prompt.target, () => setSolved(true), {
		requireAllCorrect: true,
	});

	function nextPrompt() {
		if (isLast) {
			onComplete();
			return;
		}
		setSolved(false);
		setPromptIndex(promptIndex + 1);
	}

	return (
		<div className="lesson-typing-card">
			<button
				type="button"
				className="lesson-doc__back lesson-doc__back--light"
				onClick={onBack}
			>
				← Back to lessons
			</button>

			<p className="lesson-doc__eyebrow">
				{prompts.length > 1
					? `Exercise ${promptIndex + 1} / ${prompts.length}`
					: "Exercise"}
			</p>
			<h1 className="lesson-exercise__title lesson-typing__title">{title}</h1>
			<p className="lesson-exercise__hint lesson-typing__hint">
				{hint}
				{onReplay && (
					<button
						type="button"
						className="lesson-typing__replay"
						onClick={onReplay}
						aria-label="Replay audio"
					>
						🔊
					</button>
				)}
			</p>
			{prompt.cue && (
				<p className="lesson-highlight lesson-typing__cue">{prompt.cue}</p>
			)}

			<div className="lesson-typing__passage">
				<TypingPassage
					target={prompt.target}
					typedValue={session.typedValue}
					statuses={session.statuses}
					inputRef={session.inputRef}
					onChange={session.handleChange}
					onKeyDown={session.handleKeyDown}
				/>
			</div>

			{solved && (
				<div className="lesson-exercise__actions lesson-typing__done">
					<p className="lesson-typing__done-msg">Well done!</p>
					<button
						type="button"
						className="lesson-doc__begin"
						onClick={nextPrompt}
					>
						{isLast ? completeLabel : "Next →"}
					</button>
				</div>
			)}
		</div>
	);
}
