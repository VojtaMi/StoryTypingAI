import type { TypingStats as TypingStatsResult } from "../types";
import { TypingPassage } from "./TypingPassage";
import { useTypingSession } from "./useTypingSession";

interface TypingExerciseProps {
	target: string;
	onComplete: (stats: TypingStatsResult) => void;
}

export function TypingExercise({ target, onComplete }: TypingExerciseProps) {
	const session = useTypingSession(target, onComplete);

	return (
		<div className="typing-exercise">
			<TypingPassage
				target={target}
				typedValue={session.typedValue}
				statuses={session.statuses}
				inputRef={session.inputRef}
				onChange={session.handleChange}
				onKeyDown={session.handleKeyDown}
			/>
		</div>
	);
}
