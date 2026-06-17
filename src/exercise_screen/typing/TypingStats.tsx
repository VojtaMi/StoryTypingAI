interface TypingStatsProps {
	wpm: number;
	accuracy: number;
	elapsedMs: number;
	mistakes: number;
}

export function TypingStats({
	wpm,
	accuracy,
	elapsedMs,
	mistakes,
}: TypingStatsProps) {
	return (
		<section className="stats" aria-live="polite">
			<Stat label="WPM" value={wpm.toString()} />
			<Stat label="Accuracy" value={`${accuracy}%`} />
			<Stat label="Time" value={formatTime(elapsedMs)} />
			<Stat label="Mistakes" value={mistakes.toString()} />
		</section>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="stat">
			<span className="stat__value">{value}</span>
			<span className="stat__label">{label}</span>
		</div>
	);
}

function formatTime(ms: number) {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
