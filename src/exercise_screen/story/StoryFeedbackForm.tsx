import { useState } from "react";

type Difficulty = "tooEasy" | "bitEasy" | "right" | "bitHard" | "tooHard";

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
	tooEasy: "Too easy",
	bitEasy: "A bit easy",
	right: "Just right",
	bitHard: "A bit hard",
	tooHard: "Too hard",
};

interface StoryFeedbackFormProps {
	onSubmit: (feedback: string) => void;
}

export function StoryFeedbackForm({ onSubmit }: StoryFeedbackFormProps) {
	const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
	const [note, setNote] = useState("");
	const [submitted, setSubmitted] = useState(false);

	if (submitted) {
		return (
			<p className="story__feedback-thanks">Thanks — noted for next time.</p>
		);
	}

	function handleSubmit() {
		if (!difficulty) return;
		const trimmedNote = note.trim();
		onSubmit(
			trimmedNote
				? `${DIFFICULTY_LABEL[difficulty]}. ${trimmedNote}`
				: DIFFICULTY_LABEL[difficulty],
		);
		setSubmitted(true);
	}

	return (
		<div className="story__feedback">
			<p className="story__feedback-prompt">How was this story's difficulty?</p>
			<div className="story__feedback-options">
				{(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((option) => (
					<button
						type="button"
						key={option}
						className="story__feedback-option"
						data-active={difficulty === option}
						onClick={() => setDifficulty(option)}
					>
						{DIFFICULTY_LABEL[option]}
					</button>
				))}
			</div>
			<textarea
				className="story__feedback-note"
				value={note}
				onChange={(event) => setNote(event.target.value)}
				placeholder="Anything else? (optional)"
				rows={2}
			/>
			<button
				type="button"
				className="story__feedback-submit"
				disabled={!difficulty}
				onClick={handleSubmit}
			>
				Submit feedback
			</button>
		</div>
	);
}
