import { useEffect, useMemo, useRef, useState } from "react";
import { shuffle } from "./shuffle";

/**
 * The pick-one-of-N mechanic shared by the story recap's fill-missing-word and
 * story-question exercises: shuffle the
 * choices once, flash a wrong pick, count attempts. Callers own everything else
 * (the shell, chat, `done` chrome, what happens on success) — the recap shows
 * three exercises stacked on one page, and the shell does not belong in here.
 */
export function useChoicePrompt(
	choices: string[],
	answer: string,
	onCorrect: (attempts: number) => void,
) {
	const shuffledChoices = useMemo(() => shuffle(choices), [choices]);
	const [wrongChoice, setWrongChoice] = useState<string | null>(null);
	const [wrongAttempts, setWrongAttempts] = useState(0);
	const wrongTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (wrongTimeout.current) clearTimeout(wrongTimeout.current);
		},
		[],
	);

	function choose(choice: string) {
		if (choice === answer) {
			if (wrongTimeout.current) clearTimeout(wrongTimeout.current);
			setWrongChoice(null);
			onCorrect(wrongAttempts + 1);
			return;
		}
		setWrongAttempts((count) => count + 1);
		setWrongChoice(choice);
		if (wrongTimeout.current) clearTimeout(wrongTimeout.current);
		wrongTimeout.current = setTimeout(() => setWrongChoice(null), 700);
	}

	return { shuffledChoices, wrongChoice, wrongAttempts, choose };
}
