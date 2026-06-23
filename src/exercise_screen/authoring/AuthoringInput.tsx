import { useRef } from "react";
import { ESPERANTO_KEY_MAP } from "../../esperantoKeyboard";
import { useAuthoringDraft } from "./useAuthoringDraft";

interface AuthoringInputProps {
	onSubmit: (text: string) => void;
	onAutoContinue: () => void;
}

export function AuthoringInput({
	onSubmit,
	onAutoContinue,
}: AuthoringInputProps) {
	const { draft, setDraft, submit, canSubmit } = useAuthoringDraft(onSubmit);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	function insertMappedKey(character: string) {
		const input = inputRef.current;
		if (!input) return;

		const start = input.selectionStart;
		const end = input.selectionEnd;
		const nextDraft = `${draft.slice(0, start)}${character}${draft.slice(end)}`;
		const nextCursor = start + character.length;

		setDraft(nextDraft);
		window.requestAnimationFrame(() => {
			input.setSelectionRange(nextCursor, nextCursor);
		});
	}

	return (
		<div className="authoring">
			<p className="story__hint">Now write your own continuation:</p>
			<textarea
				ref={inputRef}
				className="authoring__input"
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onKeyDown={(e) => {
					if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
					if (e.metaKey || e.ctrlKey || e.altKey) return;

					const mappedCharacter = ESPERANTO_KEY_MAP[e.key];
					if (!mappedCharacter) return;

					e.preventDefault();
					insertMappedKey(mappedCharacter);
				}}
				placeholder="What happens next? (Ctrl/Cmd+Enter to send)"
				rows={4}
			/>
			<div className="authoring__actions">
				<button
					type="button"
					className="authoring__submit"
					onClick={submit}
					disabled={!canSubmit}
				>
					Add your part
				</button>
				<button
					type="button"
					className="authoring__continue"
					onClick={onAutoContinue}
				>
					Let AI continue
				</button>
			</div>
		</div>
	);
}
