import { useCallback } from "react";
import { type SavedStory, saveStory } from "../../saves";

interface UseStoryPersistenceOptions {
	onSavedStoriesChanged: () => Promise<void>;
	onSavesError: (error: string | null) => void;
}

export function useStoryPersistence({
	onSavedStoriesChanged,
	onSavesError,
}: UseStoryPersistenceOptions) {
	return useCallback(
		async (save: Omit<SavedStory, "updatedAt">) => {
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
		},
		[onSavedStoriesChanged, onSavesError],
	);
}
