import { useCallback, useMemo, useRef, useState } from "react";
import "../lesson.css";
import { audioUrlCache, ensureLessonAudioUrl } from "../lessonAudio";
import type { IntroducedWord } from "../types";

interface WordMatchExerciseProps {
	lessonId: string;
	words: IntroducedWord[];
	title?: string;
	hint?: string;
	completeLabel?: string;
	onComplete: () => void;
	onBack: () => void;
}

function shuffle<T>(arr: T[]): T[] {
	const result = [...arr];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

export default function WordMatchExercise({
	lessonId,
	words,
	title = "Connect the words",
	hint = "Select a word on the left, then its meaning on the right.",
	completeLabel = "Continue to Practice →",
	onComplete,
	onBack,
}: WordMatchExerciseProps) {
	const terms = useMemo(() => shuffle(words.map((w) => w.term)), [words]);
	const meanings = useMemo(() => shuffle(words.map((w) => w.meaning)), [words]);
	const termToMeaning = useMemo(
		() => Object.fromEntries(words.map((w) => [w.term, w.meaning])),
		[words],
	);

	const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
	const [selectedRight, setSelectedRight] = useState<string | null>(null);
	const [matched, setMatched] = useState<Set<string>>(new Set());
	const [wrongPair, setWrongPair] = useState<{
		term: string;
		meaning: string;
	} | null>(null);
	const wrongTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	const playTerm = useCallback(
		(term: string) => {
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current = null;
			}
			const url = audioUrlCache.get(term);
			if (url) {
				const audio = new Audio(url);
				audioRef.current = audio;
				audio.addEventListener("ended", () => {
					audioRef.current = null;
				});
				audio.play().catch(() => {
					audioRef.current = null;
				});
			} else {
				ensureLessonAudioUrl(lessonId, term)
					.then((fetchedUrl) => {
						const audio = new Audio(fetchedUrl);
						audioRef.current = audio;
						audio.addEventListener("ended", () => {
							audioRef.current = null;
						});
						audio.play().catch(() => {
							audioRef.current = null;
						});
					})
					.catch(() => {});
			}
		},
		[lessonId],
	);

	const matchedMeanings = useMemo(
		() => new Set([...matched].map((t) => termToMeaning[t])),
		[matched, termToMeaning],
	);
	const allMatched = matched.size === words.length;

	function attemptMatch(term: string, meaning: string) {
		if (wrongTimeout.current !== null) {
			clearTimeout(wrongTimeout.current);
			wrongTimeout.current = null;
		}
		setSelectedLeft(null);
		setSelectedRight(null);
		if (termToMeaning[term] === meaning) {
			setMatched((prev) => new Set([...prev, term]));
			setWrongPair(null);
		} else {
			setWrongPair({ term, meaning });
			wrongTimeout.current = setTimeout(() => {
				setWrongPair(null);
				wrongTimeout.current = null;
			}, 700);
		}
	}

	function handleLeftClick(term: string) {
		if (matched.has(term) || wrongPair !== null) return;
		playTerm(term);
		if (selectedLeft === term) {
			setSelectedLeft(null);
			return;
		}
		const right = selectedRight;
		if (right !== null) {
			attemptMatch(term, right);
		} else {
			setSelectedLeft(term);
		}
	}

	function handleRightClick(meaning: string) {
		if (matchedMeanings.has(meaning) || wrongPair !== null) return;
		if (selectedRight === meaning) {
			setSelectedRight(null);
			return;
		}
		const left = selectedLeft;
		if (left !== null) {
			attemptMatch(left, meaning);
		} else {
			setSelectedRight(meaning);
		}
	}

	return (
		<div className="lesson-page">
			<div className="lesson-doc word-match">
				<button type="button" className="lesson-doc__back" onClick={onBack}>
					← Back to lessons
				</button>

				<p className="lesson-doc__eyebrow">Exercise</p>
				<h1 className="word-match__title">{title}</h1>
				<p className="word-match__hint">{hint}</p>

				<div className="word-match__columns">
					<div className="word-match__col">
						{terms.map((term) => {
							const isMatched = matched.has(term);
							const isSelected = selectedLeft === term;
							const isWrong = wrongPair?.term === term;
							return (
								<button
									key={term}
									type="button"
									className={[
										"word-match__item",
										isMatched && "word-match__item--matched",
										isSelected && "word-match__item--selected",
										isWrong && "word-match__item--wrong",
									]
										.filter(Boolean)
										.join(" ")}
									onClick={() => handleLeftClick(term)}
									disabled={isMatched}
								>
									{term}
								</button>
							);
						})}
					</div>

					<div className="word-match__col word-match__col--right">
						{meanings.map((meaning) => {
							const isMatched = matchedMeanings.has(meaning);
							const isSelected = selectedRight === meaning;
							const isWrong = wrongPair?.meaning === meaning;
							return (
								<button
									key={meaning}
									type="button"
									className={[
										"word-match__item",
										isMatched && "word-match__item--matched",
										isSelected && "word-match__item--selected",
										isWrong && "word-match__item--wrong",
									]
										.filter(Boolean)
										.join(" ")}
									onClick={() => handleRightClick(meaning)}
									disabled={isMatched}
								>
									{meaning}
								</button>
							);
						})}
					</div>
				</div>

				{allMatched && (
					<div className="word-match__done">
						<p className="word-match__done-msg">All matched!</p>
						<button
							type="button"
							className="lesson-doc__begin"
							onClick={onComplete}
						>
							{completeLabel}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
