interface StoryLoadingProps {
	streamingTarget: string;
}

export function StoryLoading({ streamingTarget }: StoryLoadingProps) {
	return (
		<div className="story__streaming" aria-live="polite">
			<p className="story__hint">The story unfolds...</p>
			{streamingTarget ? (
				<p className="streaming-preview">{streamingTarget}</p>
			) : (
				<p className="loading">The story unfolds...</p>
			)}
		</div>
	);
}
