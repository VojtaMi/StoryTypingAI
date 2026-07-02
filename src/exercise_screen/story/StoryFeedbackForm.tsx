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
			<p className="lesson-doc__paragraph">Thanks — noted for next time.</p>
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
		<div className="story-completion__feedback">
			<p className="lesson-doc__subheading">How was this story's difficulty?</p>
			<div className="phrase-builder__tiles">
				{(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((option) => (
					<button
						type="button"
						key={option}
						className={
							difficulty === option
								? "phrase-builder__selected"
								: "phrase-builder__tile"
						}
						onClick={() => setDifficulty(option)}
					>
						{DIFFICULTY_LABEL[option]}
					</button>
				))}
			</div>
			<textarea
				className="story-completion__note"
				value={note}
				onChange={(event) => setNote(event.target.value)}
				placeholder="Anything else? (optional)"
				rows={2}
			/>
			<button
				type="button"
				className="lesson-doc__begin"
				disabled={!difficulty}
				onClick={handleSubmit}
			>
				Submit feedback
			</button>
		</div>
	);
}
