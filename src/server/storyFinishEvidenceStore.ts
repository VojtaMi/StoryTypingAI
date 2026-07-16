import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { bundledFinishEvidencePath } from "./storyBundleStore";

/** One word looked up during a reading story, with how many times it was clicked. */
export interface FinishEvidenceLookup {
	word: string;
	count: number;
}

/**
 * The per-story finalization record, persisted beside the story save at
 * `stories/<storyId>/finish-evidence.json`. It is the control state that makes
 * story-finish finalization idempotent: the baseline evidence is applied once
 * (guarded by `baselineRefinedAt`), a late feedback update is applied to this
 * same story only (never leaking into the next), and each stamp records when a
 * refinement was durably folded into the Markdown handouts.
 */
export interface StoryFinishEvidenceRecord {
	storyId: string;
	/** Set LAST, once the profile + story-memory writes for the baseline complete. */
	baselineRefinedAt?: string;
	/** Set once a late custom-feedback update has been folded in. */
	feedbackRefinedAt?: string;
	/** Set once the recap quiz results have been folded in. */
	recapRefinedAt?: string;
	/** Stable hash of the last recap results, so an identical resubmit is a no-op. */
	recapResultsHash?: string;
	/** The story summary, kept purely as context for a later feedback update. */
	storySummary?: string;
	/** The aggregated, story-scoped word lookups folded at baseline. Audit only. */
	wordLookups?: FinishEvidenceLookup[];
	/** Unscoped menu/tutor lookups folded through the global cursor at baseline. Audit only. */
	globalWordLookups?: FinishEvidenceLookup[];
	/** Feedback that arrived before the baseline finished; applied when it does. */
	pendingFeedback?: string;
	/** The last feedback applied, so re-submitting identical feedback is a no-op. */
	appliedFeedback?: string;
}

const writeQueues = new Map<string, Promise<void>>();

/**
 * Reads the finalization record for a story. A story that has never finalized
 * has no file yet; that is not an error — return a bare record so callers can
 * treat "never finalized" and "file missing" the same way.
 */
export async function readFinishEvidence(
	storyId: string,
): Promise<StoryFinishEvidenceRecord> {
	try {
		const parsed = JSON.parse(
			await readFile(bundledFinishEvidencePath(storyId), "utf8"),
		) as StoryFinishEvidenceRecord;
		if (parsed && typeof parsed === "object") {
			return { ...parsed, storyId };
		}
	} catch {
		// Missing or unreadable → treat as "never finalized".
	}
	return { storyId };
}

async function writeFinishEvidence(
	record: StoryFinishEvidenceRecord,
): Promise<void> {
	const path = bundledFinishEvidencePath(record.storyId);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

/**
 * Merges a patch into the story's record and rewrites it. Serialized per story
 * so concurrent finalization steps (baseline, feedback, recap) cannot clobber
 * each other's stamps. Returns the merged record.
 */
export async function updateFinishEvidence(
	storyId: string,
	patch: Partial<Omit<StoryFinishEvidenceRecord, "storyId">>,
): Promise<StoryFinishEvidenceRecord> {
	let merged: StoryFinishEvidenceRecord = { storyId };
	const previous = writeQueues.get(storyId) ?? Promise.resolve();
	const next = previous
		.catch(() => undefined)
		.then(async () => {
			const current = await readFinishEvidence(storyId);
			merged = { ...current, ...patch, storyId };
			await writeFinishEvidence(merged);
		});
	writeQueues.set(
		storyId,
		next.then(
			() => undefined,
			() => undefined,
		),
	);
	await next;
	return merged;
}
