import { useMemo, useRef, useState } from "react";

export interface WordMatchPair {
	term: string;
	meaning: string;
}

function shuffle<T>(items: T[]): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

/**
 * The term/meaning matching mechanic shared by the lessons word-match
 * exercise and the story recap's word-connect exercise: shuffle both
 * columns, select a term then a meaning (or vice versa), track matches and
 * flash wrong pairs. Callers own everything else (audio, chat, completion
 * chrome, a `done` guard) by wrapping the returned handlers.
 */
export function useWordMatching(pairs: WordMatchPair[]) {
	const terms = useMemo(() => shuffle(pairs.map((pair) => pair.term)), [pairs]);
	const meanings = useMemo(
		() => shuffle(pairs.map((pair) => pair.meaning)),
		[pairs],
	);
	const termToMeaning = useMemo(
		() => Object.fromEntries(pairs.map((pair) => [pair.term, pair.meaning])),
		[pairs],
	);

	const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
	const [selectedMeaning, setSelectedMeaning] = useState<string | null>(null);
	const [matched, setMatched] = useState<Set<string>>(new Set());
	const [wrongPair, setWrongPair] = useState<{
		term: string;
		meaning: string;
	} | null>(null);
	const [wrongAttempts, setWrongAttempts] = useState(0);
	const wrongTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	const matchedMeanings = useMemo(
		() => new Set([...matched].map((term) => termToMeaning[term])),
		[matched, termToMeaning],
	);
	const allMatched = pairs.length > 0 && matched.size === pairs.length;

	function attempt(term: string, meaning: string) {
		if (wrongTimeout.current) clearTimeout(wrongTimeout.current);
		setSelectedTerm(null);
		setSelectedMeaning(null);
		if (termToMeaning[term] === meaning) {
			setMatched((prev) => new Set([...prev, term]));
			setWrongPair(null);
			return;
		}
		setWrongAttempts((count) => count + 1);
		setWrongPair({ term, meaning });
		wrongTimeout.current = setTimeout(() => setWrongPair(null), 700);
	}

	function chooseTerm(term: string) {
		if (matched.has(term) || wrongPair) return;
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
		if (matchedMeanings.has(meaning) || wrongPair) return;
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

	return {
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
	};
}
