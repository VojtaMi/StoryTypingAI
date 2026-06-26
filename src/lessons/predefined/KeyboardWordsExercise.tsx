import {
	type ChangeEvent,
	type KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { ESPERANTO_KEY_MAP } from "../../esperantoKeyboard";
import "../lesson.css";
import { audioUrlCache, ensureLessonAudioUrl } from "../lessonAudio";
import { KEYBOARD_PRACTICE_WORDS } from "./keyboardPracticeWords";

const LESSON_ID = "keyboard-intro";

interface KeyboardWordsExerciseProps {
	onComplete: () => void;
	onBack: () => void;
}

function useWordAudio() {
	const [ready, setReady] = useState<Set<string>>(
		() =>
			new Set(
				KEYBOARD_PRACTICE_WORDS.map((c) => c.term).filter((w) =>
					audioUrlCache.has(w),
				),
			),
	);
	const [playing, setPlaying] = useState<string | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	useEffect(() => {
		let cancelled = false;
		for (const { term } of KEYBOARD_PRACTICE_WORDS) {
			if (audioUrlCache.has(term)) continue;
			ensureLessonAudioUrl(LESSON_ID, term)
				.then(() => {
					if (cancelled) return;
					setReady((prev) => new Set([...prev, term]));
				})
				.catch((err) => {
					console.warn("Could not prefetch audio for:", term, err);
				});
		}
		return () => {
			cancelled = true;
			audioRef.current?.pause();
		};
	}, []);

	const play = useCallback((word: string) => {
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current = null;
		}

		const run = (url: string) => {
			setPlaying(word);
			const audio = new Audio(url);
			audioRef.current = audio;
			audio.addEventListener("ended", () => setPlaying(null));
			audio.addEventListener("error", () => setPlaying(null));
			audio.play().catch(() => setPlaying(null));
		};

		const cached = audioUrlCache.get(word);
		if (cached) {
			run(cached);
			return;
		}

		ensureLessonAudioUrl(LESSON_ID, word)
			.then((url) => {
				setReady((prev) => new Set([...prev, word]));
				run(url);
			})
			.catch(() => {});
	}, []);

	return { ready, playing, play };
}

export default function KeyboardWordsExercise({
	onComplete,
	onBack,
}: KeyboardWordsExerciseProps) {
	const [wordValues, setWordValues] = useState<string[]>(() =>
		KEYBOARD_PRACTICE_WORDS.map(() => ""),
	);
	const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
	const continueButtonRef = useRef<HTMLButtonElement | null>(null);
	const skipNextFocusPlaybackRef = useRef(false);
	const { ready, playing, play } = useWordAudio();

	const allCorrect = KEYBOARD_PRACTICE_WORDS.every(
		({ term }, i) => wordValues[i] === term,
	);

	useEffect(() => {
		skipNextFocusPlaybackRef.current = true;
		inputRefs.current[0]?.focus();
		play(KEYBOARD_PRACTICE_WORDS[0].term);
		window.requestAnimationFrame(() => {
			skipNextFocusPlaybackRef.current = false;
		});
	}, [play]);

	useEffect(() => {
		if (allCorrect) {
			continueButtonRef.current?.focus();
		}
	}, [allCorrect]);

	const updateWordValue = useCallback((index: number, value: string) => {
		const target = KEYBOARD_PRACTICE_WORDS[index].term;
		const nextValue = value.slice(0, target.length);
		setWordValues((prev) => {
			const next = [...prev];
			next[index] = nextValue;
			return next;
		});
		if (nextValue === target) {
			const nextInput = inputRefs.current[index + 1];
			if (nextInput) {
				window.requestAnimationFrame(() => nextInput.focus());
			}
		}
	}, []);

	const handleChange = useCallback(
		(index: number, e: ChangeEvent<HTMLInputElement>) => {
			updateWordValue(index, e.target.value);
		},
		[updateWordValue],
	);

	const handleFocus = useCallback(
		(word: string) => {
			if (skipNextFocusPlaybackRef.current) return;
			play(word);
		},
		[play],
	);

	const handleKeyDown = useCallback(
		(index: number, e: KeyboardEvent<HTMLInputElement>) => {
			if (e.metaKey || e.ctrlKey || e.altKey || e.key === "Tab") return;

			const mapped = ESPERANTO_KEY_MAP[e.key];
			if (!mapped) return;

			const input = inputRefs.current[index];
			if (!input) return;

			e.preventDefault();
			const target = KEYBOARD_PRACTICE_WORDS[index].term;
			const start = input.selectionStart ?? wordValues[index].length;
			const end = input.selectionEnd ?? start;
			const nextValue =
				`${wordValues[index].slice(0, start)}${mapped.toLowerCase()}${wordValues[index].slice(end)}`.slice(
					0,
					target.length,
				);
			const nextCursor = Math.min(start + mapped.length, nextValue.length);

			updateWordValue(index, nextValue);
			window.requestAnimationFrame(() => {
				input.setSelectionRange(nextCursor, nextCursor);
			});
		},
		[updateWordValue, wordValues],
	);

	return (
		<div className="lesson-page">
			<article className="lesson-doc" aria-labelledby="keyboard-words-title">
				<button type="button" className="lesson-doc__back" onClick={onBack}>
					← Back to lessons
				</button>

				<p className="lesson-doc__eyebrow">Absolute beginner · Exercise</p>
				<h1 id="keyboard-words-title" className="lesson-doc__title">
					Beginner Words
				</h1>
				<p className="lesson-doc__lede">Now type the full words yourself.</p>

				<div className="key-words key-words--page">
					{KEYBOARD_PRACTICE_WORDS.map(({ term, meaning }, i) => {
						const typed = wordValues[i];
						const isCorrect = typed === term;
						const isWrong = typed.length === term.length && typed !== term;
						return (
							<div
								key={term}
								className={`key-words__item${isCorrect ? " key-words__item--correct" : ""}${isWrong ? " key-words__item--wrong" : ""}`}
							>
								<div className="key-words__prompt">
									<span className="key-words__word">{term}</span>
									<span className="key-words__meaning">{meaning}</span>
									<button
										type="button"
										className={`lesson-speak${playing === term ? " lesson-speak--active" : ""}${!ready.has(term) ? " lesson-speak--loading" : ""}`}
										aria-label={
											playing === term ? "Playing…" : `Listen to "${term}"`
										}
										onClick={() => play(term)}
										disabled={
											!ready.has(term) || (playing !== null && playing !== term)
										}
									>
										🔊
									</button>
								</div>
								<input
									ref={(el) => {
										inputRefs.current[i] = el;
									}}
									type="text"
									className={`key-words__input${isCorrect ? " key-words__input--correct" : ""}${isWrong ? " key-words__input--wrong" : ""}`}
									value={typed}
									onChange={(e) => handleChange(i, e)}
									onFocus={() => handleFocus(term)}
									onKeyDown={(e) => handleKeyDown(i, e)}
									maxLength={term.length}
									placeholder={term}
									aria-label={`Type ${term}`}
									spellCheck={false}
									autoComplete="off"
									autoCorrect="off"
									autoCapitalize="off"
								/>
							</div>
						);
					})}
				</div>

				{allCorrect && (
					<div className="lesson-doc__actions">
						<button
							ref={continueButtonRef}
							type="button"
							className="lesson-doc__begin"
							onClick={onComplete}
						>
							Continue →
						</button>
					</div>
				)}
			</article>
		</div>
	);
}
