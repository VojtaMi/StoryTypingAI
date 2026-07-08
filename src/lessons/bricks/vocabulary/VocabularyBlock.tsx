import type { LessonBodyRenderCtx } from "../contracts";
import type { LessonVocabularyBlock } from "./index";

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

export function VocabularyBlock({
	block,
	ctx,
}: {
	block: LessonVocabularyBlock;
	ctx: LessonBodyRenderCtx;
}) {
	return (
		<dl className="lesson-doc__words">
			{block.words.map((word) => (
				<div key={word.term} className="lesson-doc__word">
					<dt className="lesson-doc__word-term">
						{word.term}
						<span className="lesson-doc__word-pos">{word.partOfSpeech}</span>
						<SpeakButton
							id={`word-${word.term}`}
							text={word.term}
							ready={ctx.ready.has(word.term)}
							playing={ctx.playing}
							onPlay={ctx.onPlay}
						/>
					</dt>
					<dd className="lesson-doc__word-body">
						<span className="lesson-doc__word-meaning">{word.meaning}</span>
					</dd>
				</div>
			))}
		</dl>
	);
}
