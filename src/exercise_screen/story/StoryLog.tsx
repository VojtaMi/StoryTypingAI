import type { StorySegment } from "../types";

interface StoryLogProps {
	segments: StorySegment[];
}

export function StoryLog({ segments }: StoryLogProps) {
	if (segments.length === 0) return null;

	return (
		<div className="story__log">
			{segments.map((segment) => (
				<p key={segment.id} className={`segment segment--${segment.author}`}>
					{segment.text}
				</p>
			))}
		</div>
	);
}
