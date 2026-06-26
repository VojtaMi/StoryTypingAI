import { Fragment } from "react";
import "./lesson.css";
import { LESSON_LEVEL_LABELS, type Lesson } from "./types";

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

export default function LessonIntro({
	lesson,
	onBeginPractice,
	onBack,
}: LessonIntroProps) {
	const storyText = lesson.story.join(" ");
	const wordCount = lesson.introducedWords.length;
	const hasGrammar = lesson.grammarConcepts.length > 0;

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
					← Back to menu
				</button>

				<p className="lesson-doc__eyebrow">
					{LESSON_LEVEL_LABELS[lesson.level]} · Lesson
				</p>
				<h1 id="lesson-title" className="lesson-doc__title">
					{lesson.title}
				</h1>
				<p className="lesson-doc__lede">
					A first taste of Esperanto: {wordCount} new{" "}
					{wordCount === 1 ? "word" : "words"} and one tiny sentence you'll be
					able to read, understand, and type by the end.
				</p>

				<hr className="lesson-doc__rule" />

				<section className="lesson-doc__section">
					<h2 className="lesson-doc__heading">
						<span className="lesson-doc__num">{nextSection()}.</span> New words
					</h2>
					<dl className="lesson-doc__words">
						{lesson.introducedWords.map((word) => (
							<div key={word.term} className="lesson-doc__word">
								<dt className="lesson-doc__word-term">
									{word.term}
									<span className="lesson-doc__word-pos">
										{word.partOfSpeech}
									</span>
								</dt>
								<dd className="lesson-doc__word-body">
									<span className="lesson-doc__word-meaning">
										{word.meaning}
									</span>
									<span className="lesson-doc__word-example">
										{word.example}
									</span>
								</dd>
							</div>
						))}
					</dl>
				</section>

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

				<hr className="lesson-doc__rule" />

				<section className="lesson-doc__section">
					<h2 className="lesson-doc__heading">
						<span className="lesson-doc__num">{nextSection()}.</span> Your story
					</h2>
					<p className="lesson-doc__paragraph">
						Read it aloud, then type it from memory on the next screen.
					</p>
					<blockquote className="lesson-doc__story">{storyText}</blockquote>
				</section>

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
