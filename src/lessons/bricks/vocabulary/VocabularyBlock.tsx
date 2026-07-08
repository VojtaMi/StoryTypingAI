import type { IntroducedWord, LessonVocabularyBlock } from "../../types";
import type { LessonBodyRenderCtx } from "../contracts";
import { SpeakButton } from "../SpeakButton";
import { clozeFor } from "./index";

/** The word's example sentence with the word itself picked out of it. */
function WordExample({ word }: { word: IntroducedWord }) {
	const { before, match, after } = clozeFor(word);
	return (
		<span className="lesson-doc__word-example">
			{before}
			<strong>{match}</strong>
			{after}
		</span>
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
						<WordExample word={word} />
					</dd>
				</div>
			))}
		</dl>
	);
}
