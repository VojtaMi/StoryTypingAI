import "../lesson.css";

interface EsperantoIntroProps {
	onStart: () => void;
	onBack: () => void;
}

export default function EsperantoIntro({
	onStart,
	onBack,
}: EsperantoIntroProps) {
	return (
		<div className="lesson-page">
			<article className="lesson-doc" aria-labelledby="esperanto-intro-title">
				<button type="button" className="lesson-doc__back" onClick={onBack}>
					← Back to lessons
				</button>

				<p className="lesson-doc__eyebrow">Absolute beginner · Introduction</p>
				<h1 id="esperanto-intro-title" className="lesson-doc__title">
					What is Esperanto?
				</h1>
				<p className="lesson-doc__lede">
					A small language with a big idea: make communication feel possible
					sooner.
				</p>

				<figure className="esperanto-intro__figure">
					<img
						src="/images/esperanto-lesson-hero.png"
						alt="A warm illustrated Esperanto learning scene"
						className="esperanto-intro__image"
					/>
				</figure>

				<hr className="lesson-doc__rule" />

				<section className="lesson-doc__section">
					<h2 className="lesson-doc__heading">
						<span className="lesson-doc__num">1.</span> Built to welcome you
					</h2>
					<p className="lesson-doc__paragraph">
						Esperanto is a planned language created for people from different
						language backgrounds. Its grammar is regular, its spelling is
						consistent, and its patterns repeat in a way that lets beginners
						build confidence quickly.
					</p>
					<p className="lesson-doc__paragraph">
						You do not need to memorize a maze of exceptions before you can do
						something real. In this course, each step is small enough to finish
						and concrete enough to remember.
					</p>
				</section>

				<hr className="lesson-doc__rule" />

				<section className="lesson-doc__section esperanto-intro__split">
					<img
						src="/images/esperanto-bot-retro.png"
						alt="The Esperanto course companion"
						className="esperanto-intro__spot"
					/>
					<div>
						<h2 className="lesson-doc__heading">
							<span className="lesson-doc__num">2.</span> Learn by doing
						</h2>
						<p className="lesson-doc__paragraph">
							This little helper will stay with you through the course. When you
							see it, you can click on it to ask questions.
						</p>
						<p className="lesson-doc__paragraph">
							Now let’s start with your first practice.
						</p>
					</div>
				</section>

				<div className="lesson-doc__actions">
					<button type="button" className="lesson-doc__begin" onClick={onStart}>
						Start First Exercise
					</button>
				</div>
			</article>
		</div>
	);
}
