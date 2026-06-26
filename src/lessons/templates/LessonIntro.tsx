import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import "../lesson.css";
import { audioUrlCache, ensureLessonAudioUrl } from "../lessonAudio";
import type { Lesson, LessonTeachingSection } from "../types";
import { LESSON_LEVEL_LABELS } from "../types";

interface LessonIntroProps {
	lesson: Lesson;
	onBeginPractice: (lesson: Lesson) => void;
	onBack: () => void;
}

/** Renders text with inline `code` spans marked by backticks. */
function renderWithCode(text: string) {
	return text.split("`").map((part, index) =>
		index % 2 === 1 ? (
			// biome-ignore lint/suspicious/noArrayIndexKey: static, order-stable split
			<code key={index} className="lesson-doc__code">
				{part}
			</code>
		) : (
			// biome-ignore lint/suspicious/noArrayIndexKey: static, order-stable split
			<Fragment key={index}>{part}</Fragment>
		),
	);
}

function useLessonAudio(lesson: Lesson) {
	const storyText = lesson.story.join(" ");
	const allTexts = [...lesson.introducedWords.map((w) => w.term), storyText];

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
			aria-label={isPlaying ? "Playing…" : `Listen to "${text}"`}
			onClick={() => onPlay(id, text)}
			disabled={!ready || (playing !== null && !isPlaying)}
		>
			🔊
		</button>
	);
}

function TeachingSection({
	section,
	sectionNumber,
}: {
	section: LessonTeachingSection;
	sectionNumber: number;
}) {
	return (
		<>
			<hr className="lesson-doc__rule" />
			<section className="lesson-doc__section">
				<h2 className="lesson-doc__heading">
					<span className="lesson-doc__num">{sectionNumber}.</span>{" "}
					{section.title}
				</h2>

				{section.type === "overview" &&
					section.body.map((paragraph) => (
						<p key={paragraph} className="lesson-doc__paragraph">
							{renderWithCode(paragraph)}
						</p>
					))}

				{section.type === "possessive-table" && (
					<table className="lesson-table">
						<thead>
							<tr className="lesson-table__row lesson-table__row--head">
								<th scope="col">Pronoun</th>
								<th scope="col">Meaning</th>
								<th scope="col">Adjective</th>
								<th scope="col">Meaning</th>
							</tr>
						</thead>
						<tbody>
							{section.rows.map((row) => (
								<tr
									key={`${row.pronoun}-${row.possessive}`}
									className="lesson-table__row"
								>
									<td className="lesson-table__term">{row.pronoun}</td>
									<td>{row.pronounMeaning}</td>
									<td className="lesson-table__term">{row.possessive}</td>
									<td>{row.possessiveMeaning}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}

				{section.type === "color-table" && (
					<table className="lesson-color-table">
						<tbody>
							{section.rows.map((row) => (
								<tr key={row.term} className="lesson-color-table__row">
									<td className="lesson-color-table__swatch-cell">
										<span
											className="lesson-color-table__swatch"
											style={{ backgroundColor: row.color }}
											aria-hidden="true"
										/>
									</td>
									<td className="lesson-table__term">{row.term}</td>
									<td>{row.meaning}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}

				{section.type === "examples" && (
					<div className="lesson-examples">
						{section.examples.map((example) => (
							<div key={example.phrase} className="lesson-examples__row">
								<span className="lesson-examples__phrase">
									{example.phrase}
								</span>
								<span className="lesson-examples__meaning">
									{example.meaning}
								</span>
							</div>
						))}
					</div>
				)}
			</section>
		</>
	);
}

export default function LessonIntro({
	lesson,
	onBeginPractice,
	onBack,
}: LessonIntroProps) {
	const storyText = lesson.story.join(" ");
	const wordCount = lesson.introducedWords.length;
	const hasTeachingSections = (lesson.teachingSections?.length ?? 0) > 0;
	const hasGrammar = !hasTeachingSections && lesson.grammarConcepts.length > 0;
	const hasPatterns =
		!hasTeachingSections && (lesson.patterns?.length ?? 0) > 0;
	const { ready, playing, play } = useLessonAudio(lesson);

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

				{hasTeachingSections ? (
					lesson.teachingSections?.map((section) => (
						<TeachingSection
							key={section.id}
							section={section}
							sectionNumber={nextSection()}
						/>
					))
				) : (
					<>
						<hr className="lesson-doc__rule" />

						<section className="lesson-doc__section">
							<h2 className="lesson-doc__heading">
								<span className="lesson-doc__num">{nextSection()}.</span> New
								words
							</h2>
							<dl className="lesson-doc__words">
								{lesson.introducedWords.map((word) => (
									<div key={word.term} className="lesson-doc__word">
										<dt className="lesson-doc__word-term">
											{word.term}
											<span className="lesson-doc__word-pos">
												{word.partOfSpeech}
											</span>
											<SpeakButton
												id={`word-${word.term}`}
												text={word.term}
												ready={ready.has(word.term)}
												playing={playing}
												onPlay={play}
											/>
										</dt>
										<dd className="lesson-doc__word-body">
											<span className="lesson-doc__word-meaning">
												{word.meaning}
											</span>
										</dd>
									</div>
								))}
							</dl>
						</section>
					</>
				)}

				{hasGrammar && (
					<>
						<hr className="lesson-doc__rule" />
						<section className="lesson-doc__section">
							<h2 className="lesson-doc__heading">
								<span className="lesson-doc__num">{nextSection()}.</span>{" "}
								Grammar
							</h2>
							{lesson.grammarConcepts.map((concept) => (
								<div key={concept.id} className="lesson-doc__grammar">
									<h3 className="lesson-doc__subheading">{concept.title}</h3>
									<p className="lesson-doc__paragraph">
										{renderWithCode(concept.explanation)}
									</p>
									{concept.examples.map((example) => (
										<p key={example} className="lesson-doc__example">
											{example}
										</p>
									))}
								</div>
							))}
						</section>
					</>
				)}

				{hasPatterns && (
					<>
						<hr className="lesson-doc__rule" />
						<section className="lesson-doc__section">
							<h2 className="lesson-doc__heading">
								<span className="lesson-doc__num">{nextSection()}.</span>{" "}
								Patterns
							</h2>
							{lesson.patterns?.map((pattern) => (
								<div key={pattern.id} className="lesson-doc__grammar">
									<h3 className="lesson-doc__subheading">{pattern.title}</h3>
									<p className="lesson-doc__paragraph">
										{pattern.slots.join(" + ")}
									</p>
									{pattern.examples.map((example) => (
										<p key={example} className="lesson-doc__example">
											{example}
										</p>
									))}
								</div>
							))}
						</section>
					</>
				)}

				{!hasTeachingSections && (
					<>
						<hr className="lesson-doc__rule" />

						<section className="lesson-doc__section">
							<h2 className="lesson-doc__heading">
								<span className="lesson-doc__num">{nextSection()}.</span> Your
								story
							</h2>
							<p className="lesson-doc__paragraph">
								Read it aloud, then type it from memory on the next screen.
							</p>
							<blockquote className="lesson-doc__story">
								{storyText}
								<SpeakButton
									id="story"
									text={storyText}
									ready={ready.has(storyText)}
									playing={playing}
									onPlay={play}
								/>
							</blockquote>
						</section>
					</>
				)}

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
		</div>
	);
}
