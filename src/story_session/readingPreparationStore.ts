import type { StoryFinishEvidence } from "../ai";

const PENDING_KEY = "reading-preparation-pending";

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

export function clearPendingReadingEvidence() {
	localStorage.removeItem(PENDING_KEY);
}
