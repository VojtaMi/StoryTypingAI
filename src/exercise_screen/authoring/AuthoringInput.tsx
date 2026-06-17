import { useAuthoringDraft } from "./useAuthoringDraft";

interface AuthoringInputProps {
	onSubmit: (text: string) => void;
}

export function AuthoringInput({ onSubmit }: AuthoringInputProps) {
	const { draft, setDraft, submit, canSubmit } = useAuthoringDraft(onSubmit);

	return (
		<div className="authoring">
			<p className="story__hint">Now write your own continuation:</p>
			<textarea
				className="authoring__input"
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onKeyDown={(e) => {
					if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
				}}
				placeholder="What happens next? (Ctrl/Cmd+Enter to send)"
				rows={4}
			/>
			<button
				type="button"
				className="authoring__submit"
				onClick={submit}
				disabled={!canSubmit}
			>
				Continue story
			</button>
		</div>
	);
}
