import { useState } from "react";

export function useAuthoringDraft(onSubmit: (text: string) => void) {
	const [draft, setDraft] = useState("");

	function submit() {
		const text = draft.trim();
		if (!text) return;
		setDraft("");
		onSubmit(text);
	}

	return {
		draft,
		setDraft,
		submit,
		canSubmit: Boolean(draft.trim()),
	};
}
