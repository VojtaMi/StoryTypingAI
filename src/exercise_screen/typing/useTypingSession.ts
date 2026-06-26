import {
	type ChangeEvent,
	type KeyboardEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { ESPERANTO_KEY_MAP } from "../../esperantoKeyboard";
import type { TypingStats } from "../types";

export type CharStatus = "correct" | "incorrect" | "current" | "pending";

export function useTypingSession(
	target: string,
	onComplete: (stats: TypingStats) => void,
	options?: { requireAllCorrect?: boolean },
) {
	const requireAllCorrect = options?.requireAllCorrect ?? false;
	const [typedValue, setTypedValue] = useState("");
	const [startedAt, setStartedAt] = useState<number | null>(null);
	const [finishedAt, setFinishedAt] = useState<number | null>(null);
	const [now, setNow] = useState<number>(() => Date.now());
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const isComplete = finishedAt !== null;

	// biome-ignore lint/correctness/useExhaustiveDependencies: target is a trigger dep, not read inside
	useEffect(() => {
		setTypedValue("");
		setStartedAt(null);
		setFinishedAt(null);
		setNow(Date.now());
		inputRef.current?.focus();
	}, [target]);

	useEffect(() => {
		if (startedAt === null || isComplete) return;
		const id = window.setInterval(() => setNow(Date.now()), 200);
		return () => window.clearInterval(id);
	}, [startedAt, isComplete]);

	const statuses = useMemo<CharStatus[]>(() => {
		return target.split("").map((char, i) => {
			if (i < typedValue.length) {
				return typedValue[i] === char ? "correct" : "incorrect";
			}
			if (i === typedValue.length && !isComplete) {
				return "current";
			}
			return "pending";
		});
	}, [target, typedValue, isComplete]);

	const correctCount = useMemo(() => {
		let count = 0;
		for (let i = 0; i < typedValue.length; i++) {
			if (typedValue[i] === target[i]) count++;
		}
		return count;
	}, [typedValue, target]);

	const typedCount = typedValue.length;
	const mistakes = typedCount - correctCount;
	const accuracy =
		typedCount === 0 ? 100 : Math.round((correctCount / typedCount) * 100);
	const elapsedMs = startedAt === null ? 0 : (finishedAt ?? now) - startedAt;
	const elapsedSeconds = elapsedMs / 1000;
	const wpm =
		elapsedSeconds > 0
			? Math.round(correctCount / 5 / (elapsedSeconds / 60))
			: 0;
	const setValue = useCallback(
		(value: string) => {
			if (startedAt === null && value.length > 0) {
				const start = Date.now();
				setStartedAt(start);
				setNow(start);
			}

			setTypedValue(value);

			if (value.length === target.length) {
				let correct = 0;
				for (let i = 0; i < value.length; i++) {
					if (value[i] === target[i]) correct++;
				}
				if (requireAllCorrect && correct < value.length) return;

				const end = Date.now();
				setFinishedAt(end);
				const finalAccuracy = Math.round((correct / value.length) * 100);
				const seconds = (end - (startedAt ?? end)) / 1000;
				const finalWpm =
					seconds > 0 ? Math.round(correct / 5 / (seconds / 60)) : 0;
				onComplete({ wpm: finalWpm, accuracy: finalAccuracy });
			}
		},
		[onComplete, requireAllCorrect, startedAt, target],
	);

	const handleChange = useCallback(
		(e: ChangeEvent<HTMLTextAreaElement>) => {
			if (isComplete) return;
			const value = e.target.value.slice(0, target.length);
			setValue(value);
		},
		[isComplete, setValue, target],
	);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (isComplete || e.metaKey || e.ctrlKey || e.altKey) return;

			const mappedCharacter = ESPERANTO_KEY_MAP[e.key];
			if (!mappedCharacter) return;

			const input = inputRef.current;
			if (!input) return;

			e.preventDefault();

			const start = input.selectionStart;
			const end = input.selectionEnd;
			const nextValue =
				`${typedValue.slice(0, start)}${mappedCharacter}${typedValue.slice(end)}`.slice(
					0,
					target.length,
				);
			const nextCursor = Math.min(
				start + mappedCharacter.length,
				nextValue.length,
			);

			setValue(nextValue);
			window.requestAnimationFrame(() => {
				input.setSelectionRange(nextCursor, nextCursor);
			});
		},
		[isComplete, setValue, target, typedValue],
	);

	return {
		inputRef,
		typedValue,
		statuses,
		wpm,
		accuracy,
		elapsedMs,
		mistakes,
		handleChange,
		handleKeyDown,
	};
}
