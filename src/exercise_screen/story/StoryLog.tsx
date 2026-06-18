import type { StorySegment } from "../types";
import {
	type NarrationStatus,
	useSegmentNarration,
} from "./useSegmentNarration";

interface StoryLogProps {
	segments: StorySegment[];
}

const NARRATION_GLYPH: Record<NarrationStatus, string> = {
	idle: "🔊",
	loading: "…",
	playing: "⏸",
	error: "⚠",
};

const NARRATION_LABEL: Record<NarrationStatus, string> = {
	idle: "Play narration",
	loading: "Loading narration",
	playing: "Pause narration",
	error: "Narration failed — click to retry",
};

export function StoryLog({ segments }: StoryLogProps) {
	const { toggle, statusFor } = useSegmentNarration();

	if (segments.length === 0) return null;

	return (
		<div className="story__log">
			{segments.map((segment) => {
				const status =
					segment.author === "ai" ? statusFor(segment.text) : "idle";
				return (
					<p key={segment.id} className={`segment segment--${segment.author}`}>
						{segment.text}
						{segment.author === "ai" && (
							<button
								type="button"
								className="segment__speak"
								data-status={status}
								aria-label={NARRATION_LABEL[status]}
								title={NARRATION_LABEL[status]}
								disabled={status === "loading"}
								onClick={() => void toggle(segment.text)}
							>
								{NARRATION_GLYPH[status]}
							</button>
						)}
					</p>
				);
			})}
		</div>
	);
}
