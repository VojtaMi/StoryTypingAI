import { useMemo, useRef, useState } from "react";
import { shuffle } from "./shuffle";

export interface WordMatchPair {
	term: string;
	meaning: string;
}

interface MatchItem {
	id: number;
	value: string;
}

/**
 * The term/meaning matching mechanic for the story recap's word-connect
 * exercise: shuffle both
 * columns, select a term then a meaning (or vice versa), track matches and
 * flash wrong pairs. Callers own everything else (audio, chat, completion
 * chrome, a `done` guard) by wrapping the returned handlers.
 */
export function useWordMatching(pairs: WordMatchPair[]) {
	const terms = useMemo(
		() =>
			shuffle(pairs.map((pair, id): MatchItem => ({ id, value: pair.term }))),
		[pairs],
	);
	const meanings = useMemo(
		() =>
			shuffle(
				pairs.map((pair, id): MatchItem => ({ id, value: pair.meaning })),
			),
		[pairs],
	);

	const [selectedTerm, setSelectedTerm] = useState<number | null>(null);
	const [selectedMeaning, setSelectedMeaning] = useState<number | null>(null);
	const [matched, setMatched] = useState<Set<number>>(new Set());
	const [matchedMeanings, setMatchedMeanings] = useState<Set<number>>(
		new Set(),
	);
	const [wrongPair, setWrongPair] = useState<{
		term: number;
		meaning: number;
	} | null>(null);
	const [wrongAttempts, setWrongAttempts] = useState(0);
	const wrongTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	const allMatched = pairs.length > 0 && matched.size === pairs.length;

	function attempt(term: number, meaning: number) {
		if (wrongTimeout.current) clearTimeout(wrongTimeout.current);
		setSelectedTerm(null);
		setSelectedMeaning(null);
		const expectedMeaning = pairs[term]?.meaning.trim().toLocaleLowerCase();
		const clickedMeaning = pairs[meaning]?.meaning.trim().toLocaleLowerCase();
		if (expectedMeaning === clickedMeaning) {
			setMatched((prev) => new Set([...prev, term]));
			setMatchedMeanings((prev) => new Set([...prev, meaning]));
			setWrongPair(null);
			return;
		}
		setWrongAttempts((count) => count + 1);
		setWrongPair({ term, meaning });
		wrongTimeout.current = setTimeout(() => setWrongPair(null), 700);
	}

	function chooseTerm(term: number) {
		if (matched.has(term) || wrongPair) return;
		if (selectedTerm === term) {
			setSelectedTerm(null);
			return;
		}
		if (selectedMeaning !== null) {
			attempt(term, selectedMeaning);
		} else {
			setSelectedTerm(term);
		}
	}

	function chooseMeaning(meaning: number) {
		if (matchedMeanings.has(meaning) || wrongPair) return;
		if (selectedMeaning === meaning) {
			setSelectedMeaning(null);
			return;
		}
		if (selectedTerm !== null) {
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
