import type { LessonBodyRenderCtx } from "../contracts";
import type { LessonStoryBlock } from "./index";

function SpeakButton({
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

export function StoryBlock({
	block,
	ctx,
}: {
	block: LessonStoryBlock;
	ctx: LessonBodyRenderCtx;
}) {
	return (
		<>
			<p className="lesson-doc__paragraph">{block.intro}</p>
			<blockquote className="lesson-doc__story">
				{block.text}
				<SpeakButton
					id="story"
					text={block.text}
					ready={ctx.ready.has(block.text)}
					playing={ctx.playing}
					onPlay={ctx.onPlay}
				/>
			</blockquote>
		</>
	);
}
