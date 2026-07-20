import type { StoryFinishEvidence } from "../ai";

const PENDING_KEY = "reading-preparation-pending";
const PENDING_THEME_KEY = "reading-preparation-theme";

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
export function readPendingReadingEvidence(): StoryFinishEvidence | null {
	const stored = localStorage.getItem(PENDING_KEY);
	if (!stored) return null;
	try {
		const parsed = JSON.parse(stored) as StoryFinishEvidence;
		return parsed?.storyId ? parsed : null;
	} catch {
		return null;
	}
}

export function savePendingReadingEvidence(evidence: StoryFinishEvidence) {
	localStorage.setItem(PENDING_KEY, JSON.stringify(evidence));
}

/**
 * The learner's one-shot theme request for the next story, persisted next to the
 * pending evidence so a reload mid-lifecycle can resume with it. It rides
 * alongside — not inside — the evidence, so finalization never sees it and it
 * can never leak into the durable learner profile.
 */
export function readPendingReadingTheme(): string | null {
	return localStorage.getItem(PENDING_THEME_KEY) || null;
}

export function savePendingReadingTheme(theme: string) {
	localStorage.setItem(PENDING_THEME_KEY, theme);
}

export function clearPendingReadingEvidence() {
	localStorage.removeItem(PENDING_KEY);
	// The theme belongs to the same lifecycle: whenever the evidence is cleared
	// (settled, consumed, or discarded as stale) the one-shot theme is spent too.
	localStorage.removeItem(PENDING_THEME_KEY);
}
