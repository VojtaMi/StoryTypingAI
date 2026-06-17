import type { ChangeEvent, RefObject } from "react";
import type { CharStatus } from "./useTypingSession";

interface TypingPassageProps {
	target: string;
	typedValue: string;
	statuses: CharStatus[];
	inputRef: RefObject<HTMLTextAreaElement | null>;
	onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
}

export function TypingPassage({
	target,
	typedValue,
	statuses,
	inputRef,
	onChange,
}: TypingPassageProps) {
	return (
		<label className="passage" htmlFor="typing-input">
			{target.split("").map((char, i) => {
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: character position is the correct key here
					<span key={i} className={`char char--${statuses[i]}`}>
						{char}
					</span>
				);
			})}
			<textarea
				id="typing-input"
				ref={inputRef}
				className="hidden-input"
				value={typedValue}
				onChange={onChange}
				maxLength={target.length}
				rows={1}
				autoComplete="off"
				autoCorrect="off"
				autoCapitalize="off"
				spellCheck={false}
				aria-label="Typing input"
			/>
		</label>
	);
}
