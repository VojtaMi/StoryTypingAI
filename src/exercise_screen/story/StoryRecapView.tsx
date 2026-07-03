import type React from "react";
import { useMemo, useRef, useState } from "react";
import "../../lessons/lesson.css";
import type {
	StoryRecapExercise,
	StoryRecapExerciseResult,
	StoryRecapLesson,
	StoryRecapWordConnectExercise,
} from "../../storyRecap";

interface StoryRecapViewProps {
	lesson: StoryRecapLesson | null;
	error: string | null;
	onComplete: (results: StoryRecapExerciseResult[]) => void;
	onRetry: () => void;
	onSkip: () => void;
}

function describeExercise(exercise: StoryRecapExercise): string {
	if (exercise.type === "word-connect") {
		return exercise.pairs
			.map((pair) => `${pair.term} = ${pair.meaning}`)
			.join(", ");
	}
	if (exercise.type === "fill-missing-word") {
		return `${exercise.sentenceBeforeBlank}___${exercise.sentenceAfterBlank} (${exercise.answer})`;
	}
	return `${exercise.question} -> ${exercise.answer}`;
}

function shuffle<T>(items: T[]): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

function itemClass(...modifiers: (string | false | null)[]): string {
	return ["word-match__item", ...modifiers.filter(Boolean)].join(" ");
}

export function StoryRecapView({
	lesson,
	error,
	onComplete,
	onRetry,
	onSkip,
}: StoryRecapViewProps) {
	const [completed, setCompleted] = useState<Set<string>>(new Set());
	const [attempts, setAttempts] = useState<Record<string, number>>({});
	const allDone = lesson ? completed.size === lesson.exercises.length : false;

	function markComplete(id: string, attemptCount: number) {
		setCompleted((prev) => new Set([...prev, id]));
		setAttempts((prev) => ({ ...prev, [id]: attemptCount }));
	}

	function handleContinue() {
		if (!lesson) return;
		onComplete(
			lesson.exercises.map((exercise) => ({
				id: exercise.id,
				type: exercise.type,
				label: describeExercise(exercise),
				attempts: attempts[exercise.id] ?? 1,
			})),
		);
	}

	if (!lesson) {
		return (
			<div className="story-recap">
				<p className="lesson-doc__eyebrow">Eta praktiko</p>
				<h2 className="lesson-doc__heading">Preparing your recap</h2>
				<p className="lesson-doc__paragraph">
					A few tiny questions are being made from the story you just read.
				</p>
				{error ? (
					<div className="story-recap__error">
						<p>{error}</p>
						<div className="story-recap__actions">
							<button
								type="button"
								className="lesson-doc__begin"
								onClick={onRetry}
							>
								Try again
							</button>
							<button
								type="button"
								className="word-match__item"
								onClick={onSkip}
							>
								Skip recap
							</button>
						</div>
					</div>
				) : (
					<p className="lesson-doc__paragraph">Generating practice...</p>
				)}
			</div>
		);
	}

	return (
		<div className="story-recap">
			<p className="lesson-doc__eyebrow">Eta praktiko</p>
			<h2 className="lesson-doc__heading">{lesson.title}</h2>
			<div className="story-recap__list">
				{lesson.exercises.map((exercise) => (
					<RecapExercise
						key={exercise.id}
						exercise={exercise}
						done={completed.has(exercise.id)}
						onComplete={(attemptCount) =>
							markComplete(exercise.id, attemptCount)
						}
					/>
				))}
			</div>
			{allDone && (
				<div className="story-recap__actions story-recap__actions--end">
					<button
						type="button"
						className="lesson-doc__begin"
						onClick={handleContinue}
					>
						Continue
					</button>
				</div>
			)}
		</div>
	);
}

function RecapExercise({
	exercise,
	done,
	onComplete,
}: {
	exercise: StoryRecapExercise;
	done: boolean;
	onComplete: (attempts: number) => void;
}) {
	if (exercise.type === "word-connect") {
		return (
			<WordConnectRecap
				exercise={exercise}
				done={done}
				onComplete={onComplete}
			/>
		);
	}

	if (exercise.type === "fill-missing-word") {
		return (
			<ChoiceRecap
				title={exercise.title}
				hint={exercise.hint}
				prompt={
					<span>
						{exercise.sentenceBeforeBlank}
						<span className="story-recap__blank">_____</span>
						{exercise.sentenceAfterBlank}
					</span>
				}
				answer={exercise.answer}
				choices={exercise.choices}
				done={done}
				onComplete={onComplete}
			/>
		);
	}

	return (
		<ChoiceRecap
			title={exercise.title}
			hint={exercise.hint}
			prompt={exercise.question}
			answer={exercise.answer}
			choices={exercise.choices}
			done={done}
			onComplete={onComplete}
		/>
	);
}

function WordConnectRecap({
	exercise,
	done,
	onComplete,
}: {
	exercise: StoryRecapWordConnectExercise;
	done: boolean;
	onComplete: (attempts: number) => void;
}) {
	const terms = useMemo(
		() => exercise.pairs.map((pair) => pair.term),
		[exercise],
	);
	const meanings = useMemo(
		() => shuffle(exercise.pairs.map((pair) => pair.meaning)),
		[exercise],
	);
	const termToMeaning = useMemo(
		() =>
			Object.fromEntries(
				exercise.pairs.map((pair) => [pair.term, pair.meaning]),
			),
		[exercise],
	);
	const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
	const [selectedMeaning, setSelectedMeaning] = useState<string | null>(null);
	const [matched, setMatched] = useState<Set<string>>(new Set());
	const [wrongPair, setWrongPair] = useState<{
		term: string;
		meaning: string;
	} | null>(null);
	const [wrongAttempts, setWrongAttempts] = useState(0);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const matchedMeanings = useMemo(
		() => new Set([...matched].map((term) => termToMeaning[term])),
		[matched, termToMeaning],
	);

	function attempt(term: string, meaning: string) {
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		setSelectedTerm(null);
		setSelectedMeaning(null);
		if (termToMeaning[term] === meaning) {
			const next = new Set([...matched, term]);
			setMatched(next);
			setWrongPair(null);
			if (next.size === exercise.pairs.length) onComplete(wrongAttempts + 1);
			return;
		}
		setWrongAttempts((count) => count + 1);
		setWrongPair({ term, meaning });
		timeoutRef.current = setTimeout(() => setWrongPair(null), 700);
	}

	function chooseTerm(term: string) {
		if (done || matched.has(term) || wrongPair) return;
		if (selectedTerm === term) {
			setSelectedTerm(null);
			return;
		}
		if (selectedMeaning) {
			attempt(term, selectedMeaning);
		} else {
			setSelectedTerm(term);
		}
	}

	function chooseMeaning(meaning: string) {
		if (done || matchedMeanings.has(meaning) || wrongPair) return;
		if (selectedMeaning === meaning) {
			setSelectedMeaning(null);
			return;
		}
		if (selectedTerm) {
			attempt(selectedTerm, meaning);
		} else {
			setSelectedMeaning(meaning);
		}
	}

	return (
		<section className="story-recap__exercise">
			<ExerciseHeader title={exercise.title} hint={exercise.hint} done={done} />
			<div className="word-match__columns">
				<div className="word-match__col">
					{terms.map((term) => (
						<button
							key={term}
							type="button"
							className={itemClass(
								matched.has(term) && "word-match__item--matched",
								selectedTerm === term && "word-match__item--selected",
								wrongPair?.term === term && "word-match__item--wrong",
							)}
							disabled={matched.has(term)}
							onClick={() => chooseTerm(term)}
						>
							{term}
						</button>
					))}
				</div>
				<div className="word-match__col">
					{meanings.map((meaning) => (
						<button
							key={meaning}
							type="button"
							className={itemClass(
								matchedMeanings.has(meaning) && "word-match__item--matched",
								selectedMeaning === meaning && "word-match__item--selected",
								wrongPair?.meaning === meaning && "word-match__item--wrong",
							)}
							disabled={matchedMeanings.has(meaning)}
							onClick={() => chooseMeaning(meaning)}
						>
							{meaning}
						</button>
					))}
				</div>
			</div>
		</section>
	);
}

function ChoiceRecap({
	title,
	hint,
	prompt,
	answer,
	choices,
	done,
	onComplete,
}: {
	title: string;
	hint: string;
	prompt: React.ReactNode;
	answer: string;
	choices: string[];
	done: boolean;
	onComplete: (attempts: number) => void;
}) {
	const shuffledChoices = useMemo(() => shuffle(choices), [choices]);
	const [wrongChoice, setWrongChoice] = useState<string | null>(null);
	const [wrongAttempts, setWrongAttempts] = useState(0);

	function choose(choice: string) {
		if (done) return;
		if (choice === answer) {
			setWrongChoice(null);
			onComplete(wrongAttempts + 1);
			return;
		}
		setWrongAttempts((count) => count + 1);
		setWrongChoice(choice);
		setTimeout(() => setWrongChoice(null), 700);
	}

	return (
		<section className="story-recap__exercise">
			<ExerciseHeader title={title} hint={hint} done={done} />
			<p className="story-recap__prompt">{prompt}</p>
			<div className="word-match__col">
				{shuffledChoices.map((choice) => (
					<button
						key={choice}
						type="button"
						className={itemClass(
							done && choice === answer && "word-match__item--correct",
							wrongChoice === choice && "word-match__item--wrong",
						)}
						disabled={done}
						onClick={() => choose(choice)}
					>
						{choice}
					</button>
				))}
			</div>
		</section>
	);
}

function ExerciseHeader({
	title,
	hint,
	done,
}: {
	title: string;
	hint: string;
	done: boolean;
}) {
	return (
		<div className="story-recap__exercise-head">
			<div>
				<h3 className="lesson-doc__subheading">{title}</h3>
				<p>{hint}</p>
			</div>
			{done && <span className="story-recap__done-badge">Done</span>}
		</div>
	);
}
