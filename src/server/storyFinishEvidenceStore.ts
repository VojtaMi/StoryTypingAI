import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ReadingChainHint } from "../story";
import type { StoryRecapEvidenceItem } from "./learnerProfileService";
import { bundledFinishEvidencePath } from "./storyBundleStore";

/** One word looked up during a reading story, with how many times it was clicked. */
export interface FinishEvidenceLookup {
	word: string;
	count: number;
}

/**
 * The per-story finalization record, persisted beside the story save at
 * `stories/<storyId>/finish-evidence.json`. It is the control state that makes
 * story-finish finalization idempotent: the complete evidence bundle is applied
 * once, and late evidence is applied to this same story only.
 */
export interface StoryFinishEvidenceRecord {
	storyId: string;
	/** Set once the complete story evidence bundle has been folded. */
	finalizedAt?: string;
	/** Learner questions included in the final evidence bundle. */
	learnerQuestions?: string[];
	/** Recap results included in the final evidence bundle. */
	recapResults?: StoryRecapEvidenceItem[];
	/** Custom feedback included in the final evidence bundle. */
	feedback?: string;
	/** The story summary, kept purely as context for a later feedback update. */
	storySummary?: string;
	/**
	 * The transient reading-chain hint the producer emitted for the NEXT story.
	 * Read by the reading-opening preparation via `basedOnStoryId`; never folded
	 * into the durable shared learner state.
	 */
	readingChain?: ReadingChainHint;
	/** The aggregated, story-scoped word lookups folded at baseline. Audit only. */
	wordLookups?: FinishEvidenceLookup[];
	/** Unscoped menu/tutor lookups folded through the global cursor at baseline. Audit only. */
	globalWordLookups?: FinishEvidenceLookup[];
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
			return {
				storyId,
				...(typeof parsed.finalizedAt === "string"
					? { finalizedAt: parsed.finalizedAt }
					: {}),
				...(Array.isArray(parsed.learnerQuestions)
					? { learnerQuestions: parsed.learnerQuestions }
					: {}),
				...(Array.isArray(parsed.recapResults)
					? { recapResults: parsed.recapResults }
					: {}),
				...(typeof parsed.feedback === "string"
					? { feedback: parsed.feedback }
					: {}),
				...(typeof parsed.storySummary === "string"
					? { storySummary: parsed.storySummary }
					: {}),
				...(parsed.readingChain &&
				typeof parsed.readingChain === "object" &&
				!Array.isArray(parsed.readingChain)
					? { readingChain: parsed.readingChain }
					: {}),
				...(Array.isArray(parsed.wordLookups)
					? { wordLookups: parsed.wordLookups }
					: {}),
				...(Array.isArray(parsed.globalWordLookups)
					? { globalWordLookups: parsed.globalWordLookups }
					: {}),
			};
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
