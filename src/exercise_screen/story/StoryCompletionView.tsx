import "../../lessons/lesson.css";
import { StoryFeedbackForm } from "./StoryFeedbackForm";

interface StoryCompletionViewProps {
	storyId: string | null;
	currentImageUrl: string | null;
	readingTotalParts: number | null;
	storyFeedbackSubmittedAt: string | null;
	/** True only for a story just finished in this live session. */
	feedbackEditable: boolean;
	/** The prior feedback shown read-only when a finished save is reopened. */
	priorFeedback: string | null;
	canShowGallery: boolean;
	onOpenGallery: () => void;
	onSubmitStoryFeedback: (
		feedback: string,
		nextStoryTheme: string,
		practiceRequest: string,
	) => void;
	onStoryFeedbackDraftChange: (
		feedback: string,
		nextStoryTheme: string,
		practiceRequest: string,
	) => void;
}

export function StoryCompletionView({
	storyId,
	currentImageUrl,
	readingTotalParts,
	storyFeedbackSubmittedAt,
	feedbackEditable,
	priorFeedback,
	canShowGallery,
	onOpenGallery,
	onSubmitStoryFeedback,
	onStoryFeedbackDraftChange,
}: StoryCompletionViewProps) {
	return (
		<div className="story-completion">
			<p className="lesson-doc__eyebrow">Story complete</p>
			<h2 className="lesson-doc__heading">Congratulations</h2>
			<p className="lesson-doc__lede">
				{readingTotalParts !== null
					? `You finished all ${readingTotalParts} parts.`
					: "You finished the whole story."}
			</p>

			<div className="story-completion__actions">
				{canShowGallery && (
					<button
						type="button"
						className="word-match__item"
						onClick={onOpenGallery}
					>
						Review gallery
					</button>
				)}
			</div>

			{canShowGallery && currentImageUrl && (
				<button
					type="button"
					className="story-completion__preview"
					onClick={onOpenGallery}
					aria-label="Review story image gallery"
				>
					<img src={currentImageUrl} alt="Latest story scene" />
				</button>
			)}

			{feedbackEditable ? (
				<>
					<hr className="lesson-doc__rule" />
					<StoryFeedbackForm
						key={storyId}
						onSubmit={onSubmitStoryFeedback}
						onDraftChange={onStoryFeedbackDraftChange}
						submitted={storyFeedbackSubmittedAt !== null}
					/>
				</>
			) : (
				priorFeedback && (
					<>
						<hr className="lesson-doc__rule" />
						<p className="lesson-doc__subheading">Your feedback</p>
						<p className="lesson-doc__paragraph">{priorFeedback}</p>
					</>
				)
			)}
		</div>
	);
}
