import type { LessonStoryBlock } from "../../types";
import type { LessonBodyRenderCtx } from "../contracts";
import { SpeakButton } from "../SpeakButton";

/**
 * The story as one string. This is also its audio cache key, so it must keep
 * matching `lessonNarratableTexts(lesson)[0]` — the story is narrated whole,
 * not per sentence, which would multiply TTS calls by five.
 */
export function storyBlockText(block: LessonStoryBlock): string {
	return block.sentences.join(" ");
}

export function StoryBlock({
	block,
	ctx,
}: {
	block: LessonStoryBlock;
	ctx: LessonBodyRenderCtx;
}) {
	const text = storyBlockText(block);
	return (
		<>
			<p className="lesson-doc__paragraph">{block.intro}</p>
			<blockquote className="lesson-doc__story">
				<span className="lesson-doc__story-lines">
					{block.sentences.map((sentence) => (
						<span key={sentence} className="lesson-doc__story-line">
							{sentence}
						</span>
					))}
				</span>
				<SpeakButton
					id="story"
					text={text}
					ready={ctx.ready.has(text)}
					playing={ctx.playing}
					onPlay={ctx.onPlay}
				/>
			</blockquote>
		</>
	);
}
