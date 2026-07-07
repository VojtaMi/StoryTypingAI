import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { ESPERANTO_KEY_MAP } from "../../esperantoKeyboard";
import "../lesson.css";
import { useWordAudio, useWordAudioPlayer } from "../lessonAudio";

const KEYBOARD_CHARS = [
	{ char: "ŝ", key: "q", word: "ŝipo" },
	{ char: "ĝ", key: "w", word: "ĝardeno" },
	{ char: "ŭ", key: "y", word: "aŭto" },
	{ char: "ĵ", key: "[", word: "ĵurnalo" },
	{ char: "ĥ", key: "]", word: "eĥo" },
	{ char: "ĉ", key: "x", word: "ĉambro" },
] as const;

const KEYBOARD_AUDIO_WORDS = KEYBOARD_CHARS.map(({ word }) => word);

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

export default function KeyboardIntroExercise({
	onComplete,
	onBack,
}: KeyboardIntroExerciseProps) {
	const [values, setValues] = useState<string[]>(() =>
		KEYBOARD_CHARS.map(() => ""),
	);
	const ready = useWordAudio(KEYBOARD_AUDIO_WORDS);
	const { playing, play } = useWordAudioPlayer();
	const [demoText, setDemoText] = useState("");
	const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
	const continueButtonRef = useRef<HTMLButtonElement | null>(null);

	useEffect(() => {
		inputRefs.current[0]?.focus();
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
					play(KEYBOARD_CHARS[index].word);
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
		[play],
	);

	const handleMiniKeyboardPress = useCallback((key: string) => {
		const mapped = ESPERANTO_KEY_MAP[key];
		const output = mapped ? mapped.toLowerCase() : key;
		setDemoText((prev) => `${prev}${output}`);
	}, []);

	const handleDemoKeyDown = useCallback(
		(e: KeyboardEvent<HTMLInputElement>) => {
			if (e.metaKey || e.ctrlKey || e.altKey) return;

			const mapped = ESPERANTO_KEY_MAP[e.key];
			if (!mapped) return;

			e.preventDefault();
			const input = e.currentTarget;
			const start = input.selectionStart ?? demoText.length;
			const end = input.selectionEnd ?? start;
			const nextValue = `${demoText.slice(0, start)}${mapped}${demoText.slice(end)}`;
			const nextCursor = start + mapped.length;

			setDemoText(nextValue);
			window.requestAnimationFrame(() => {
				input.setSelectionRange(nextCursor, nextCursor);
			});
		},
		[demoText],
	);

	return (
		<div className="lesson-page">
			<article className="lesson-doc" aria-labelledby="keyboard-intro-title">
				<button type="button" className="lesson-doc__back" onClick={onBack}>
					← Back to lessons
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
						onKeyDown={handleDemoKeyDown}
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
													? `Insert ${mapped}, typed with ${key}`
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
										🔊
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
