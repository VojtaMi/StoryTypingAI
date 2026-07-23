import { useEffect, useState } from "react";
import {
	STORY_DIFFICULTIES,
	STORY_DIFFICULTY_LABEL,
	type StoryDifficulty,
	type StoryFeedbackRecord,
} from "../../storyFeedback";

interface StoryFeedbackFormProps {
	/**
	 * Explicit Submit. Difficulty and the practice request steer the next
	 * objective; the theme is a one-shot subject request.
	 */
	onSubmit: (record: StoryFeedbackRecord) => void;
	/**
	 * Reports the form's current contents as they change, so leaving the
	 * completion screen resolves them even without an explicit Submit.
	 */
	onDraftChange: (record: StoryFeedbackRecord) => void;
	submitted: boolean;
}

export function StoryFeedbackForm({
	onSubmit,
	onDraftChange,
	submitted,
}: StoryFeedbackFormProps) {
	const [difficulty, setDifficulty] = useState<StoryDifficulty | null>(null);
	const [practiceRequest, setPracticeRequest] = useState("");
	const [nextStoryTheme, setNextStoryTheme] = useState("");

	const record: StoryFeedbackRecord = {
		difficulty,
		practiceRequest,
		nextStoryTheme,
	};

	useEffect(() => {
		onDraftChange({ difficulty, practiceRequest, nextStoryTheme });
	}, [difficulty, practiceRequest, nextStoryTheme, onDraftChange]);

	if (submitted) {
		return (
			<p className="lesson-doc__paragraph">Thanks — noted for next time.</p>
		);
	}

	return (
		<div className="story-completion__feedback">
			<p className="lesson-doc__subheading">How was this story's difficulty?</p>
			<div className="phrase-builder__tiles">
				{STORY_DIFFICULTIES.map((option) => (
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
						{STORY_DIFFICULTY_LABEL[option]}
					</button>
				))}
			</div>

			<p className="lesson-doc__subheading">
				What felt tricky, or what would you like to practice next?
			</p>
			<textarea
				className="story-completion__note"
				value={practiceRequest}
				onChange={(event) => setPracticeRequest(event.target.value)}
				placeholder="e.g. the -n endings confused me, I want more past tense (optional)"
				rows={2}
			/>

			<p className="lesson-doc__subheading">Theme for your next story</p>
			<textarea
				className="story-completion__note"
				value={nextStoryTheme}
				onChange={(event) => setNextStoryTheme(event.target.value)}
				placeholder="e.g. a shipwreck on a deserted island (optional)"
				rows={2}
			/>

			<button
				type="button"
				className="lesson-doc__begin"
				disabled={!difficulty}
				onClick={() => difficulty && onSubmit(record)}
			>
				Submit feedback
			</button>
		</div>
	);
}
