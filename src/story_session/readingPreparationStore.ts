import type { StoryFinishEvidence } from "../ai";
import type { GenreId } from "../genres";

const pendingKey = (languageId: GenreId) =>
	`reading-preparation-pending:${languageId}`;
const pendingThemeKey = (languageId: GenreId) =>
	`reading-preparation-theme:${languageId}`;

/**
 * The evidence of a finished story whose lifecycle has not yet produced a
 * prepared story.
 *
 * The lifecycle runs in the page, and preparation is only started once
 * finalization resolves — so a reload in between kills it, and nothing else
 * would ever prepare the next story. Persisting the evidence lets the next load
 * resume the lifecycle instead of stranding it. Re-finalizing is safe: the
 * server is idempotent per story id.
 */
export function readPendingReadingEvidence(
	languageId: GenreId,
): StoryFinishEvidence | null {
	const stored = localStorage.getItem(pendingKey(languageId));
	if (!stored) return null;
	try {
		const parsed = JSON.parse(stored) as StoryFinishEvidence;
		return parsed?.storyId ? parsed : null;
	} catch {
		return null;
	}
}

export function savePendingReadingEvidence(evidence: StoryFinishEvidence) {
	localStorage.setItem(pendingKey(evidence.genreId), JSON.stringify(evidence));
}

/**
 * The learner's one-shot theme request for the next story, persisted next to the
 * pending evidence so a reload mid-lifecycle can resume with it. It rides
 * alongside — not inside — the evidence, so finalization never sees it and it
 * can never leak into the durable learner profile.
 */
export function readPendingReadingTheme(languageId: GenreId): string | null {
	return localStorage.getItem(pendingThemeKey(languageId)) || null;
}

export function savePendingReadingTheme(languageId: GenreId, theme: string) {
	localStorage.setItem(pendingThemeKey(languageId), theme);
}

export function clearPendingReadingEvidence(languageId: GenreId) {
	localStorage.removeItem(pendingKey(languageId));
	// The theme belongs to the same lifecycle: whenever the evidence is cleared
	// (settled, consumed, or discarded as stale) the one-shot theme is spent too.
	localStorage.removeItem(pendingThemeKey(languageId));
}
