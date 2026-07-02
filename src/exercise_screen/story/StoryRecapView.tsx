import type React from "react";
import { useMemo, useRef, useState } from "react";
import type {
	StoryRecapExercise,
	StoryRecapLesson,
	StoryRecapWordConnectExercise,
} from "../../storyRecap";

interface StoryRecapViewProps {
	lesson: StoryRecapLesson | null;
	error: string | null;
	onComplete: () => void;
	onRetry: () => void;
	onSkip: () => void;
}

function shuffle<T>(items: T[]): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

export function StoryRecapView({
	lesson,
	error,
	onComplete,
	onRetry,
	onSkip,
}: StoryRecapViewProps) {
	const [completed, setCompleted] = useState<Set<string>>(new Set());
	const allDone = lesson ? completed.size === lesson.exercises.length : false;

	function markComplete(id: string) {
		setCompleted((prev) => new Set([...prev, id]));
	}

	if (!lesson) {
		return (
			<div className="story__reading story-recap">
				<p className="story__reading-progress">Eta praktiko</p>
				<h2 className="story-recap__title">Preparing your recap</h2>
				<p className="story-recap__hint">
					A few tiny questions are being made from the story you just read.
				</p>
				{error ? (
					<div className="story-recap__error">
						<p>{error}</p>
						<div className="story-recap__actions">
							<button type="button" onClick={onRetry}>
								Try again
							</button>
							<button type="button" onClick={onSkip}>
								Skip recap
							</button>
						</div>
					</div>
				) : (
					<p className="story-recap__loading">Generating practice...</p>
				)}
			</div>
		);
	}

	return (
		<div className="story__reading story-recap">
			<p className="story__reading-progress">Eta praktiko</p>
			<h2 className="story-recap__title">{lesson.title}</h2>
			<div className="story-recap__list">
				{lesson.exercises.map((exercise) => (
					<RecapExercise
						key={exercise.id}
						exercise={exercise}
						done={completed.has(exercise.id)}
						onComplete={() => markComplete(exercise.id)}
					/>
				))}
			</div>
			{allDone && (
				<div className="story-recap__actions story-recap__actions--end">
					<button type="button" onClick={onComplete}>
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
	onComplete: () => void;
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
	onComplete: () => void;
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
			if (next.size === exercise.pairs.length) onComplete();
			return;
		}
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
		<section className="story-recap__exercise" data-done={done}>
			<ExerciseHeader title={exercise.title} hint={exercise.hint} done={done} />
			<div className="story-recap__match">
				<div className="story-recap__match-col">
					{terms.map((term) => (
						<button
							key={term}
							type="button"
							className="story-recap__choice"
							data-selected={selectedTerm === term}
							data-correct={matched.has(term)}
							data-wrong={wrongPair?.term === term}
							disabled={matched.has(term)}
							onClick={() => chooseTerm(term)}
						>
							{term}
						</button>
					))}
				</div>
				<div className="story-recap__match-col">
					{meanings.map((meaning) => (
						<button
							key={meaning}
							type="button"
							className="story-recap__choice"
							data-selected={selectedMeaning === meaning}
							data-correct={matchedMeanings.has(meaning)}
							data-wrong={wrongPair?.meaning === meaning}
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
	onComplete: () => void;
}) {
	const shuffledChoices = useMemo(() => shuffle(choices), [choices]);
	const [wrongChoice, setWrongChoice] = useState<string | null>(null);

	function choose(choice: string) {
		if (done) return;
		if (choice === answer) {
			setWrongChoice(null);
			onComplete();
			return;
		}
		setWrongChoice(choice);
		setTimeout(() => setWrongChoice(null), 700);
	}

	return (
		<section className="story-recap__exercise" data-done={done}>
			<ExerciseHeader title={title} hint={hint} done={done} />
			<p className="story-recap__prompt">{prompt}</p>
			<div className="story-recap__choices">
				{shuffledChoices.map((choice) => (
					<button
						key={choice}
						type="button"
						className="story-recap__choice"
						data-correct={done && choice === answer}
						data-wrong={wrongChoice === choice}
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
				<h3>{title}</h3>
				<p>{hint}</p>
			</div>
			{done && <span>Done</span>}
		</div>
	);
}
