import { useEffect, useState } from "react";

type Difficulty = "tooEasy" | "bitEasy" | "right" | "bitHard" | "tooHard";

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
	tooEasy: "Too easy",
	bitEasy: "A bit easy",
	right: "Just right",
	bitHard: "A bit hard",
	tooHard: "Too hard",
};

/** Composes the feedback string identically for submit and draft capture. */
function composeFeedback(difficulty: Difficulty | null, taste: string): string {
	if (!difficulty) return "";
	const trimmedTaste = taste.trim();
	return trimmedTaste
		? `${DIFFICULTY_LABEL[difficulty]}. ${trimmedTaste}`
		: DIFFICULTY_LABEL[difficulty];
}

interface StoryFeedbackFormProps {
	/**
	 * `feedback` composes difficulty and taste into the profile-refinement
	 * evidence; `nextStoryTheme` is the learner's one-shot request for the next
	 * story's subject, kept separate so it never enters durable preferences.
	 */
	onSubmit: (feedback: string, nextStoryTheme: string) => void;
	/**
	 * Reports the form's current contents as they change, so leaving the
	 * completion screen resolves them even without an explicit Submit.
	 */
	onDraftChange: (feedback: string, nextStoryTheme: string) => void;
	submitted: boolean;
}

export function StoryFeedbackForm({
	onSubmit,
	onDraftChange,
	submitted,
}: StoryFeedbackFormProps) {
	const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
	const [taste, setTaste] = useState("");
	const [nextTheme, setNextTheme] = useState("");

	useEffect(() => {
		onDraftChange(composeFeedback(difficulty, taste), nextTheme.trim());
	}, [difficulty, taste, nextTheme, onDraftChange]);

	if (submitted) {
		return (
			<p className="lesson-doc__paragraph">Thanks — noted for next time.</p>
		);
	}

	function handleSubmit() {
		if (!difficulty) return;
		onSubmit(composeFeedback(difficulty, taste), nextTheme.trim());
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
								? "lesson-choice lesson-choice--selected phrase-builder__selected"
								: "lesson-choice phrase-builder__tile"
						}
						aria-pressed={difficulty === option}
						onClick={() => setDifficulty(option)}
					>
						{DIFFICULTY_LABEL[option]}
					</button>
				))}
			</div>

			<p className="lesson-doc__subheading">
				What would you like more or less of?
			</p>
			<textarea
				className="story-completion__note"
				value={taste}
				onChange={(event) => setTaste(event.target.value)}
				placeholder="e.g. more fantasy, I like horses, more diverse characters (optional)"
				rows={2}
			/>

			<p className="lesson-doc__subheading">Theme for your next story</p>
			<textarea
				className="story-completion__note"
				value={nextTheme}
				onChange={(event) => setNextTheme(event.target.value)}
				placeholder="e.g. a shipwreck on a deserted island (optional)"
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
