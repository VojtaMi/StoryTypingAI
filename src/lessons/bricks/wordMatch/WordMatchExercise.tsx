import { useState } from "react";
import { EsperantoChatModal } from "../../../exercise_screen/chatbot/EsperantoChatModal";
import "../../lesson.css";
import { useWordAudioPlayer } from "../../lessonAudio";
import type { IntroducedWord } from "../../types";
import { useWordMatching } from "../../useWordMatching";

interface WordMatchExerciseProps {
	words: IntroducedWord[];
	backgroundIntro?: string;
	title?: string;
	hint?: string;
	completeLabel?: string;
	onComplete: () => void;
	onBack: () => void;
}

export default function WordMatchExercise({
	words,
	backgroundIntro,
	title = "Connect the words",
	hint = "Select a word on the left, then its meaning on the right.",
	completeLabel = "Continue to Practice →",
	onComplete,
	onBack,
}: WordMatchExerciseProps) {
	const [chatOpen, setChatOpen] = useState(false);
	const {
		terms,
		meanings,
		selectedTerm: selectedLeft,
		selectedMeaning: selectedRight,
		matched,
		matchedMeanings,
		wrongPair,
		allMatched,
		chooseTerm,
		chooseMeaning,
	} = useWordMatching(words);
	const { play: playTerm } = useWordAudioPlayer();

	function handleLeftClick(term: string) {
		if (matched.has(term) || wrongPair) return;
		playTerm(term);
		chooseTerm(term);
	}

	function handleRightClick(meaning: string) {
		chooseMeaning(meaning);
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

			{backgroundIntro && (
				<EsperantoChatModal
					isOpen={chatOpen}
					onOpen={() => setChatOpen(true)}
					segments={[]}
					currentTarget={null}
					backgroundIntro={backgroundIntro}
					onClose={() => setChatOpen(false)}
				/>
			)}
		</div>
	);
}
