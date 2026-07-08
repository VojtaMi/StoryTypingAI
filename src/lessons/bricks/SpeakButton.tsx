/** The 🔊 affordance every body brick uses to play its text through `LessonBodyRenderCtx`. */
export function SpeakButton({
	id,
	text,
	ready,
	playing,
	onPlay,
}: {
	id: string;
	text: string;
	ready: boolean;
	playing: string | null;
	onPlay: (id: string, text: string) => void;
}) {
	const isPlaying = playing === id;
	return (
		<button
			type="button"
			className={`lesson-speak${isPlaying ? " lesson-speak--active" : ""}${!ready ? " lesson-speak--loading" : ""}`}
			aria-label={isPlaying ? "Playing..." : `Listen to "${text}"`}
			onClick={() => onPlay(id, text)}
			disabled={!ready || (playing !== null && !isPlaying)}
		>
			🔊
		</button>
	);
}
