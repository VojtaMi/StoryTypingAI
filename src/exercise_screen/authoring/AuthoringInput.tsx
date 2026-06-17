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
