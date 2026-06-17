import { useCallback } from "react";
import { titleStory } from "../../ai";
import type { TextModelId } from "../../models";
import { loadSavedStory, type SavedStory, saveStory } from "../../saves";

interface UseStoryPersistenceOptions {
	model: TextModelId;
	activeSaveIdRef: { current: string | null };
	onSavedStoriesChanged: () => Promise<void>;
	onSavesError: (error: string | null) => void;
	onTitleGenerated: (title: string) => void;
}

export function useStoryPersistence({
	model,
	activeSaveIdRef,
	onSavedStoriesChanged,
	onSavesError,
	onTitleGenerated,
}: UseStoryPersistenceOptions) {
	return useCallback(
		async (
			save: Omit<SavedStory, "updatedAt">,
			options: { generateTitle?: boolean } = {},
		) => {
			const stamped: SavedStory = {
				...save,
				updatedAt: new Date().toISOString(),
			};

			try {
				onSavesError(null);
				await saveStory(stamped);
				await onSavedStoriesChanged();
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				onSavesError(`Could not save story: ${message}`);
				return;
			}

			if (!options.generateTitle) return;

			try {
				const title = await titleStory(save.messages, model);
				if (!title) return;
				const latest = await loadSavedStory(save.id).catch(() => stamped);
				const titled: SavedStory = {
					...latest,
					title,
					updatedAt: new Date().toISOString(),
				};
				if (activeSaveIdRef.current === save.id) onTitleGenerated(title);
				await saveStory(titled);
				await onSavedStoriesChanged();
			} catch {
				// The fallback title has already been saved, so title failures should not
				// block the local save flow.
			}
		},
		[
			activeSaveIdRef,
			model,
			onSavedStoriesChanged,
			onSavesError,
			onTitleGenerated,
		],
	);
}
