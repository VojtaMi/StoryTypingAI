import { useMemo, useState } from "react";
import { EsperantoChatModal } from "../../../exercise_screen/chatbot/EsperantoChatModal";
import "../../lesson.css";
import { useWordAudioPlayer } from "../../lessonAudio";
import { shuffle } from "../../shuffle";
import type { PhraseBuilderPrompt } from "../../types";

interface PhraseBuilderExerciseProps {
	title: string;
	hint: string;
	prompts: PhraseBuilderPrompt[];
	backgroundIntro?: string;
	completeLabel?: string;
	onComplete: () => void;
	onBack: () => void;
}

function sameAnswer(left: string[], right: string[]) {
	return (
		left.length === right.length && left.every((word, i) => word === right[i])
	);
}

export default function PhraseBuilderExercise({
	title,
	hint,
	prompts,
	backgroundIntro,
	completeLabel = "Continue →",
	onComplete,
	onBack,
}: PhraseBuilderExerciseProps) {
	const [promptIndex, setPromptIndex] = useState(0);
	const [chatOpen, setChatOpen] = useState(false);
	const [selected, setSelected] = useState<string[]>([]);
	const [wrong, setWrong] = useState(false);
	const { play: playWord } = useWordAudioPlayer();

	const prompt = prompts[promptIndex];
	const isLast = promptIndex === prompts.length - 1;
	const tiles = useMemo(
		() => shuffle([...prompt.answer, ...(prompt.distractors ?? [])]),
		[prompt],
	);
	const isCorrect = sameAnswer(selected, prompt.answer);

	function chooseTile(tile: string) {
		if (selected.length >= prompt.answer.length || wrong || isCorrect) return;
		playWord(tile);
		setSelected((prev) => [...prev, tile]);
	}

	function removeSelected(index: number) {
		if (wrong || isCorrect) return;
		playWord(selected[index]);
		setSelected((prev) => prev.filter((_, i) => i !== index));
	}

	function checkAnswer() {
		setWrong(true);
		window.setTimeout(() => {
			setWrong(false);
			setSelected([]);
		}, 650);
	}

	function nextPrompt() {
		const nextIndex = promptIndex + 1;
		if (nextIndex < prompts.length) {
			setSelected([]);
			setWrong(false);
			setPromptIndex(nextIndex);
		} else {
			onComplete();
		}
	}

	return (
		<div className="lesson-page">
			<div className="lesson-doc phrase-builder">
				<button type="button" className="lesson-doc__back" onClick={onBack}>
					← Back to lessons
				</button>

				<p className="lesson-doc__eyebrow">
					Exercise {promptIndex + 1} / {prompts.length}
				</p>
				<h1 className="phrase-builder__title">{title}</h1>
				<p className="phrase-builder__hint">{hint}</p>

				<div className="phrase-builder__prompt">
					<span className="phrase-builder__prompt-label">Build</span>
					<span className="phrase-builder__meaning">{prompt.meaning}</span>
				</div>

				<div
					className={`phrase-builder__answer${wrong ? " phrase-builder__answer--wrong" : ""}${isCorrect ? " phrase-builder__answer--correct" : ""}`}
				>
					{selected.length === 0 && (
						<span className="phrase-builder__placeholder">
							Choose the Esperanto tiles
						</span>
					)}
					{selected.map((word, index) => (
						<button
							// biome-ignore lint/suspicious/noArrayIndexKey: duplicate words can be valid in generated prompts
							key={`${word}-${index}`}
							type="button"
							className="phrase-builder__selected"
							onClick={() => removeSelected(index)}
						>
							{word}
						</button>
					))}
				</div>

				<div className="phrase-builder__tiles">
					{tiles.map((tile, index) => {
						const usedCount = selected.filter((word) => word === tile).length;
						const tileCount = tiles
							.slice(0, index + 1)
							.filter((word) => word === tile).length;
						const isUsed = usedCount >= tileCount;
						return (
							<button
								// biome-ignore lint/suspicious/noArrayIndexKey: duplicate words can be valid in generated prompts
								key={`${tile}-${index}`}
								type="button"
								className="phrase-builder__tile"
								onClick={() => chooseTile(tile)}
								disabled={isUsed || isCorrect}
							>
								{tile}
							</button>
						);
					})}
				</div>

				<div className="phrase-builder__actions">
					{!isCorrect && (
						<button
							type="button"
							className="lesson-doc__begin"
							onClick={checkAnswer}
							disabled={selected.length !== prompt.answer.length || wrong}
						>
							Check
						</button>
					)}
					{isCorrect && (
						<button
							type="button"
							className="lesson-doc__begin"
							onClick={nextPrompt}
						>
							{isLast ? completeLabel : "Next →"}
						</button>
					)}
				</div>
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
