import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { ESPERANTO_KEY_MAP } from "../esperantoKeyboard";
import "./lesson.css";
import { audioUrlCache, ensureLessonAudioUrl } from "./lessonAudio";

const LESSON_ID = "keyboard-intro";

const KEYBOARD_CHARS = [
	{ char: "ŝ", key: "q", word: "ŝipo" },
	{ char: "ĝ", key: "w", word: "ĝardeno" },
	{ char: "ŭ", key: "y", word: "aŭto" },
	{ char: "ĵ", key: "[", word: "ĵurnalo" },
	{ char: "ĥ", key: "]", word: "eĥo" },
	{ char: "ĉ", key: "x", word: "ĉambro" },
] as const;

const MINI_KEYBOARD_ROWS = [
	["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]"],
	["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"],
	["z", "x", "c", "v", "b", "n", "m", ",", "."],
] as const;

function HighlightedWord({ word, char }: { word: string; char: string }) {
	const idx = word.indexOf(char);
	if (idx === -1) return <span className="key-intro__word">{word}</span>;
	return (
		<span className="key-intro__word">
			{word.slice(0, idx)}
			<mark className="key-intro__word-hl">{char}</mark>
			{word.slice(idx + char.length)}
		</span>
	);
}

interface KeyboardIntroExerciseProps {
	onComplete: () => void;
	onBack: () => void;
}

function useCharAudio() {
	const [ready, setReady] = useState<Set<string>>(
		() =>
			new Set(
				KEYBOARD_CHARS.map((c) => c.word).filter((w) => audioUrlCache.has(w)),
			),
	);
	const [playing, setPlaying] = useState<string | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	useEffect(() => {
		let cancelled = false;
		for (const { word } of KEYBOARD_CHARS) {
			if (audioUrlCache.has(word)) continue;
			ensureLessonAudioUrl(LESSON_ID, word)
				.then(() => {
					if (cancelled) return;
					setReady((prev) => new Set([...prev, word]));
				})
				.catch((err) => {
					console.warn("Could not prefetch audio for:", word, err);
				});
		}
		return () => {
			cancelled = true;
		};
	}, []);

	const play = useCallback((word: string) => {
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current = null;
		}
		const url = audioUrlCache.get(word);
		if (!url) return;
		setPlaying(word);
		const audio = new Audio(url);
		audioRef.current = audio;
		audio.addEventListener("ended", () => setPlaying(null));
		audio.addEventListener("error", () => setPlaying(null));
		audio.play().catch(() => setPlaying(null));
	}, []);

	return { ready, playing, play };
}

export default function KeyboardIntroExercise({
	onComplete,
	onBack,
}: KeyboardIntroExerciseProps) {
	const [values, setValues] = useState<string[]>(() =>
		KEYBOARD_CHARS.map(() => ""),
	);
	const { ready, playing, play } = useCharAudio();
	const [demoText, setDemoText] = useState("");
	const [keyboardStatus, setKeyboardStatus] = useState<string | null>(null);
	const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
	const continueButtonRef = useRef<HTMLButtonElement | null>(null);
	const keyboardStatusTimer = useRef<number | null>(null);

	useEffect(() => {
		inputRefs.current[0]?.focus();
	}, []);

	useEffect(() => {
		return () => {
			if (keyboardStatusTimer.current !== null) {
				window.clearTimeout(keyboardStatusTimer.current);
			}
		};
	}, []);

	const allCorrect = KEYBOARD_CHARS.every((c, i) => values[i] === c.char);

	useEffect(() => {
		if (allCorrect) {
			continueButtonRef.current?.focus();
		}
	}, [allCorrect]);

	const handleKeyDown = useCallback(
		(index: number, e: KeyboardEvent<HTMLInputElement>) => {
			if (e.metaKey || e.ctrlKey || e.altKey || e.key === "Tab") return;

			const mapped = ESPERANTO_KEY_MAP[e.key];
			if (mapped) {
				e.preventDefault();
				const lc = mapped.toLowerCase();
				setValues((prev) => {
					const next = [...prev];
					next[index] = lc;
					return next;
				});
				if (lc === KEYBOARD_CHARS[index].char) {
					const nextInput = inputRefs.current[index + 1];
					if (nextInput) {
						window.requestAnimationFrame(() => nextInput.focus());
					}
				}
				return;
			}

			if (e.key === "Backspace" || e.key === "Delete") {
				e.preventDefault();
				setValues((prev) => {
					const next = [...prev];
					next[index] = "";
					return next;
				});
				return;
			}

			if (e.key.length === 1) {
				e.preventDefault();
				setValues((prev) => {
					const next = [...prev];
					next[index] = e.key;
					return next;
				});
			}
		},
		[],
	);

	const handleMiniKeyboardPress = useCallback((key: string) => {
		const mapped = ESPERANTO_KEY_MAP[key];
		const output = mapped ? mapped.toLowerCase() : key;
		setDemoText((prev) => `${prev}${output}`);

		if (keyboardStatusTimer.current !== null) {
			window.clearTimeout(keyboardStatusTimer.current);
		}

		if (mapped) {
			void navigator.clipboard?.writeText(output).catch(() => undefined);
			setKeyboardStatus(`Copied and inserted ${output}`);
		} else {
			setKeyboardStatus(`Inserted ${output}`);
		}

		keyboardStatusTimer.current = window.setTimeout(() => {
			setKeyboardStatus(null);
		}, 1800);
	}, []);

	return (
		<div className="lesson-page">
			<article className="lesson-doc" aria-labelledby="keyboard-intro-title">
				<button type="button" className="lesson-doc__back" onClick={onBack}>
					← Back
				</button>

				<p className="lesson-doc__eyebrow">Absolute beginner · Lesson</p>
				<h1 id="keyboard-intro-title" className="lesson-doc__title">
					Special Characters
				</h1>
				<p className="lesson-doc__lede">
					Esperanto uses six letters not found on standard keyboards. This app
					remaps them to nearby keys so you can type them without any special
					software.
				</p>

				<fieldset className="mini-keyboard">
					<label className="mini-keyboard__label" htmlFor="keyboard-demo">
						Try the keyboard
					</label>
					<input
						id="keyboard-demo"
						type="text"
						className="mini-keyboard__demo"
						value={demoText}
						onChange={(event) => setDemoText(event.target.value)}
						placeholder="Click highlighted keys..."
						spellCheck={false}
						autoComplete="off"
					/>
					<div className="mini-keyboard__rows">
						{MINI_KEYBOARD_ROWS.map((row) => (
							<div className="mini-keyboard__row" key={row.join("")}>
								{row.map((key) => {
									const mapped = ESPERANTO_KEY_MAP[key]?.toLowerCase();
									return (
										<button
											type="button"
											key={key}
											className={`mini-keyboard__key${mapped ? " mini-keyboard__key--special" : ""}`}
											onClick={() => handleMiniKeyboardPress(key)}
											aria-label={
												mapped
													? `Insert and copy ${mapped}, typed with ${key}`
													: `Insert ${key}`
											}
										>
											<span className="mini-keyboard__key-main">
												{mapped ?? key}
											</span>
											{mapped && (
												<span className="mini-keyboard__key-sub">{key}</span>
											)}
										</button>
									);
								})}
							</div>
						))}
					</div>
					<div className="mini-keyboard__status" aria-live="polite">
						{keyboardStatus}
					</div>
				</fieldset>

				<hr className="lesson-doc__rule" />

				<section className="lesson-doc__section">
					<h2 className="lesson-doc__heading">
						<span className="lesson-doc__num">1.</span> The six letters
					</h2>
					<p className="lesson-doc__paragraph">
						Listen to each character, then type the highlighted key to practise
						the mapping.
					</p>

					<div className="key-intro__grid">
						{KEYBOARD_CHARS.map(({ char, key, word }, i) => {
							const typed = values[i];
							const isCorrect = typed === char;
							const isWrong = typed !== "" && !isCorrect;
							return (
								<div
									key={char}
									className={`key-intro__card${isCorrect ? " key-intro__card--correct" : ""}${isWrong ? " key-intro__card--wrong" : ""}`}
								>
									<HighlightedWord word={word} char={char} />
									<button
										type="button"
										className={`lesson-speak${playing === word ? " lesson-speak--active" : ""}${!ready.has(word) ? " lesson-speak--loading" : ""}`}
										aria-label={
											playing === word ? "Playing…" : `Listen to "${word}"`
										}
										onClick={() => play(word)}
										disabled={
											!ready.has(word) || (playing !== null && playing !== word)
										}
									>
										{playing === char ? "▶" : "🔊"}
									</button>
									<div className="key-intro__mapping">
										type <kbd className="key-intro__kbd">{key}</kbd>
									</div>
									<input
										ref={(el) => {
											inputRefs.current[i] = el;
										}}
										type="text"
										readOnly
										className={`key-intro__input${isCorrect ? " key-intro__input--correct" : ""}${isWrong ? " key-intro__input--wrong" : ""}`}
										value={typed}
										onKeyDown={(e) => handleKeyDown(i, e)}
										aria-label={`Type ${char}`}
										spellCheck={false}
										autoComplete="off"
									/>
								</div>
							);
						})}
					</div>
				</section>

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
