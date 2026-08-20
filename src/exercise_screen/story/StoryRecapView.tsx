import type React from "react";
import { useEffect, useRef, useState } from "react";
import type {
	StoryRecapExercise,
	StoryRecapExerciseResult,
	StoryRecapLesson,
	StoryRecapWordConnectExercise,
} from "../../storyRecap";
import { useChoicePrompt } from "./recap/useChoicePrompt";
import { useWordMatching } from "./recap/useWordMatching";

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

function itemClass(...modifiers: (string | false | null)[]): string {
	return [
		"lesson-choice",
		"word-match__item",
		...modifiers.filter(Boolean),
	].join(" ");
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
				<p className="lesson-doc__eyebrow">Story practice</p>
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
			<p className="lesson-doc__eyebrow">Story practice</p>
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
	const {
		terms,
		meanings,
		selectedTerm,
		selectedMeaning,
		matched,
		matchedMeanings,
		wrongPair,
		wrongAttempts,
		allMatched,
		chooseTerm,
		chooseMeaning,
	} = useWordMatching(exercise.pairs);
	const completedRef = useRef(false);

	useEffect(() => {
		if (allMatched && !completedRef.current) {
			completedRef.current = true;
			onComplete(wrongAttempts + 1);
		}
	}, [allMatched, wrongAttempts, onComplete]);

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
								selectedTerm === term && "lesson-choice--selected",
								wrongPair?.term === term && "lesson-choice--wrong",
							)}
							disabled={done || matched.has(term)}
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
								selectedMeaning === meaning && "lesson-choice--selected",
								wrongPair?.meaning === meaning && "lesson-choice--wrong",
							)}
							disabled={done || matchedMeanings.has(meaning)}
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
	const { shuffledChoices, wrongChoice, choose } = useChoicePrompt(
		choices,
		answer,
		onComplete,
	);

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
							done && choice === answer && "lesson-choice--correct",
							wrongChoice === choice && "lesson-choice--wrong",
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
