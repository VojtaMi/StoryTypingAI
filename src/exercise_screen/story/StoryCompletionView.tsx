import "../../lessons/lesson.css";
import { StoryFeedbackForm } from "./StoryFeedbackForm";

interface StoryCompletionViewProps {
	storyId: string | null;
	currentImageUrl: string | null;
	readingTotalParts: number | null;
	storyFeedbackSubmittedAt: string | null;
	canShowGallery: boolean;
	onOpenGallery: () => void;
	onSubmitStoryFeedback: (feedback: string, nextStoryTheme: string) => void;
}

export function StoryCompletionView({
	storyId,
	currentImageUrl,
	readingTotalParts,
	storyFeedbackSubmittedAt,
	canShowGallery,
	onOpenGallery,
	onSubmitStoryFeedback,
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

			<hr className="lesson-doc__rule" />
			<StoryFeedbackForm
				key={storyId}
				onSubmit={onSubmitStoryFeedback}
				submitted={storyFeedbackSubmittedAt !== null}
			/>
		</div>
	);
}
