import { useCallback, useEffect, useRef, useState } from "react";
import { EsperantoChatModal } from "../../exercise_screen/chatbot/EsperantoChatModal";
import {
	type LessonBodyBlock,
	lessonBodyBlocks,
	renderLessonBodyBlock,
} from "../bricks/lessonBodyBricks";
import "../lesson.css";
import { audioUrlCache, ensureLessonAudioUrl } from "../lessonAudio";
import { buildLessonBotContext } from "../lessonBotContext";
import { lessonNarratableTexts, lessonVocab } from "../lessonContent";
import type { Lesson } from "../types";
import { LESSON_LEVEL_LABELS } from "../types";

interface LessonIntroProps {
	lesson: Lesson;
	onBeginPractice: (lesson: Lesson) => void;
	onBack: () => void;
}

function useLessonAudio(lesson: Lesson) {
	const allTexts = lessonNarratableTexts(lesson);

	const [ready, setReady] = useState<Set<string>>(
		() => new Set(allTexts.filter((t) => audioUrlCache.has(t))),
	);
	const [playing, setPlaying] = useState<string | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: allTexts is derived from the lesson which is stable for the component's lifetime
	useEffect(() => {
		let cancelled = false;
		for (const text of allTexts) {
			if (audioUrlCache.has(text)) continue;
			ensureLessonAudioUrl(lesson.id, text)
				.then(() => {
					if (cancelled) return;
					setReady((prev) => new Set([...prev, text]));
				})
				.catch((err) => {
					console.warn("Could not prefetch lesson audio for:", text, err);
				});
		}
		return () => {
			cancelled = true;
		};
	}, []);

	const play = useCallback((key: string, text: string) => {
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current = null;
		}
		const url = audioUrlCache.get(text);
		if (!url) return;

		setPlaying(key);
		const audio = new Audio(url);
		audioRef.current = audio;
		audio.addEventListener("ended", () => setPlaying(null));
		audio.addEventListener("error", () => setPlaying(null));
		audio.play().catch(() => setPlaying(null));
	}, []);

	return { ready, playing, play };
}

function BodySection({
	block,
	sectionNumber,
	audio,
}: {
	block: LessonBodyBlock;
	sectionNumber: number;
	audio: ReturnType<typeof useLessonAudio>;
}) {
	return (
		<>
			<hr className="lesson-doc__rule" />
			<section className="lesson-doc__section">
				<h2 className="lesson-doc__heading">
					<span className="lesson-doc__num">{sectionNumber}.</span>{" "}
					{block.title}
				</h2>

				{renderLessonBodyBlock(block, {
					ready: audio.ready,
					playing: audio.playing,
					onPlay: audio.play,
				})}
			</section>
		</>
	);
}

export default function LessonIntro({
	lesson,
	onBeginPractice,
	onBack,
}: LessonIntroProps) {
	const wordCount = lessonVocab(lesson).length;
	const bodyBlocks = lessonBodyBlocks(lesson);
	const audio = useLessonAudio(lesson);
	const [chatOpen, setChatOpen] = useState(false);

	// Number the sections that are actually shown.
	let sectionNumber = 0;
	const nextSection = () => {
		sectionNumber += 1;
		return sectionNumber;
	};

	return (
		<div className="lesson-page">
			<article className="lesson-doc" aria-labelledby="lesson-title">
				<button type="button" className="lesson-doc__back" onClick={onBack}>
					← Back to lessons
				</button>

				<p className="lesson-doc__eyebrow">
					{LESSON_LEVEL_LABELS[lesson.level]} · Lesson
				</p>
				<h1 id="lesson-title" className="lesson-doc__title">
					{lesson.title}
				</h1>
				<p className="lesson-doc__lede">
					{lesson.lede ??
						`A first taste of Esperanto: ${wordCount} new ${
							wordCount === 1 ? "word" : "words"
						} and one tiny sentence you'll be able to read, understand, and type by the end.`}
				</p>

				{bodyBlocks.map((block) => (
					<BodySection
						key={block.id}
						block={block}
						sectionNumber={nextSection()}
						audio={audio}
					/>
				))}

				<div className="lesson-doc__actions">
					<button
						type="button"
						className="lesson-doc__begin"
						onClick={() => onBeginPractice(lesson)}
					>
						Begin Practice
					</button>
				</div>
			</article>

			<EsperantoChatModal
				isOpen={chatOpen}
				onOpen={() => setChatOpen(true)}
				segments={[]}
				currentTarget={null}
				backgroundIntro={buildLessonBotContext(lesson)}
				onClose={() => setChatOpen(false)}
			/>
		</div>
	);
}
