import { useCallback, useEffect, useRef, useState } from "react";
import { finalizeReadingStoryEvidence, type StoryFinishEvidence } from "../ai";
import type { TextModelId } from "../models";
import {
	listPreparedReadingOpenings,
	prepareMissingReadingOpenings,
} from "../openings";
import {
	clearPendingReadingEvidence,
	readPendingReadingEvidence,
	savePendingReadingEvidence,
} from "./readingPreparationStore";

/**
 * Where the next reading story stands:
 *
 *     idle → finalizing → preparing → ready
 *                    └────────┴─────→ error
 *
 * The order is the point. `finalizing` folds the finished story's evidence into
 * the learner baseline and story memory; `preparing` only starts once that has
 * landed, so the next story is generated against the state the finished story
 * produced rather than the state it replaced. A story prepared too early sees
 * the previous story's memory and repeats its premise.
 *
 * The very first story — nothing finished yet, so nothing to finalize — skips
 * straight from `idle` to `preparing`. See `runInitialReadingPreparation`.
 */
export type ReadingPreparationStatus =
	| "idle"
	| "finalizing"
	| "preparing"
	| "ready"
	| "error";

interface ReadingPreparationRun {
	finalize: () => Promise<void>;
	/** Resolves with how many stories are queued once preparation has run. */
	prepare: () => Promise<{ length: number }>;
	setStatus: (status: ReadingPreparationStatus) => void;
}

/** The `preparing` step shared by the finalize-first and initial passes. */
async function prepareAndSettle(
	prepare: () => Promise<{ length: number }>,
	setStatus: (status: ReadingPreparationStatus) => void,
	warning: string,
): Promise<"ready" | "error"> {
	setStatus("preparing");
	try {
		const prepared = await prepare();
		const settled = prepared.length > 0 ? "ready" : "error";
		setStatus(settled);
		return settled;
	} catch (err) {
		console.warn(warning, err);
		setStatus("error");
		return "error";
	}
}

/**
 * One pass of the lifecycle, resolving with the status it settled on.
 * Extracted from the hook so the ordering it exists to guarantee — `prepare` is
 * never entered until `finalize` has resolved — is assertable without rendering.
 */
export async function runReadingPreparation({
	finalize,
	prepare,
	setStatus,
}: ReadingPreparationRun): Promise<"ready" | "error"> {
	setStatus("finalizing");
	try {
		await finalize();
	} catch (err) {
		// Preparing anyway would generate the next story from the state
		// finalization was meant to update — the exact repetition this lifecycle
		// exists to prevent. Surface a retry instead.
		console.warn("Could not finalize reading story evidence.", err);
		setStatus("error");
		return "error";
	}
	return prepareAndSettle(
		prepare,
		setStatus,
		"Could not prepare the next reading story.",
	);
}

/**
 * The very first reading story, prepared before any story has been finished.
 * There is no previous story's evidence to fold in, so this skips
 * `finalizing` entirely and goes straight to `preparing`.
 */
export async function runInitialReadingPreparation({
	prepare,
	setStatus,
}: {
	prepare: () => Promise<{ length: number }>;
	setStatus: (status: ReadingPreparationStatus) => void;
}): Promise<"ready" | "error"> {
	return prepareAndSettle(
		prepare,
		setStatus,
		"Could not prepare the first reading story.",
	);
}

/**
 * What a fresh page load should do about the next reading story, given the
 * durable queue and any evidence a previous page left behind.
 *
 * `resume` is the load-bearing case. The lifecycle runs in the page and only
 * starts preparation once finalization resolves, so a reload in between leaves
 * evidence with nobody acting on it. Answering `idle` there would enable the
 * button over an empty queue, and starting a story would generate one outside
 * the lifecycle, racing the finalization it is meant to follow. Answering
 * `preparing` without acting would disable the button forever, since nothing
 * else will ever fill the queue.
 *
 * `initial` is the same "nothing to act on yet" shape, but with no previous
 * story at all — a fresh install, or every reading story and the queue having
 * been cleared. Answering `idle` there enables the button over an empty queue
 * exactly like the `resume` case, except with nothing to resume: the caller
 * must start an initial (finalize-skipping) preparation instead.
 */
export function decideReadingPreparationOnLoad({
	preparedCount,
	hasPendingEvidence,
}: {
	preparedCount: number;
	hasPendingEvidence: boolean;
}): "ready" | "resume" | "initial" {
	// A queued story means the lifecycle got there, whoever finished it.
	if (preparedCount > 0) return "ready";
	if (hasPendingEvidence) return "resume";
	return "initial";
}

/** No reading story can start while the next one is being made. */
export function isReadingPreparationBusy(
	status: ReadingPreparationStatus,
): boolean {
	return status === "finalizing" || status === "preparing";
}

export interface ReadingPreparation {
	status: ReadingPreparationStatus;
	/** No reading story can start while the next one is being made. */
	busy: boolean;
	/**
	 * Finalize the just-finished story, then prepare exactly one next story.
	 * Calls naming a story that already owns the lifecycle are ignored.
	 */
	makeNextStory: (evidence: StoryFinishEvidence) => void;
	/**
	 * Re-run a lifecycle that failed. Finalization is idempotent server-side.
	 * With no evidence to finalize — nothing pending, no story ever finished —
	 * this instead (re)runs the finalize-skipping initial preparation.
	 */
	retry: () => void;
	/** Report that the prepared story has been taken off the queue. */
	markConsumed: () => void;
}

/**
 * Owns the make-the-next-reading-story lifecycle for the menu boundary. Nothing
 * here runs on menu entry: a reading story is prepared only as the consequence
 * of finishing one, so the queue holds at most the story the learner earned.
 */
export function useReadingPreparation(model: TextModelId): ReadingPreparation {
	const [status, setStatus] = useState<ReadingPreparationStatus>("idle");
	const runningRef = useRef(false);
	const runRef = useRef<StoryFinishEvidence | null>(null);
	const modelRef = useRef(model);
	modelRef.current = model;

	const run = useCallback(async (evidence: StoryFinishEvidence) => {
		if (runningRef.current) return;
		runningRef.current = true;
		runRef.current = evidence;
		// Written before the work starts, so a reload at any point from here on
		// can pick the lifecycle back up.
		savePendingReadingEvidence(evidence);
		try {
			const settled = await runReadingPreparation({
				finalize: () => finalizeReadingStoryEvidence(evidence),
				prepare: () => prepareMissingReadingOpenings(modelRef.current),
				setStatus,
			});
			// Keep the evidence on `error` — retry, here or after a reload, needs it.
			if (settled === "ready") clearPendingReadingEvidence();
		} finally {
			runningRef.current = false;
		}
	}, []);

	const runInitial = useCallback(async () => {
		if (runningRef.current) return;
		runningRef.current = true;
		runRef.current = null;
		try {
			await runInitialReadingPreparation({
				prepare: () => prepareMissingReadingOpenings(modelRef.current),
				setStatus,
			});
		} finally {
			runningRef.current = false;
		}
	}, []);

	// Readiness comes from the durable queue, not from having watched it fill.
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const pending = readPendingReadingEvidence();
			try {
				const prepared = await listPreparedReadingOpenings();
				// A live lifecycle is the better authority — don't let this answer,
				// fetched before it started, overwrite its status.
				if (cancelled || runRef.current) return;
				const decision = decideReadingPreparationOnLoad({
					preparedCount: prepared.length,
					hasPendingEvidence: pending !== null,
				});
				if (decision === "resume" && pending) {
					void run(pending);
					return;
				}
				if (decision === "ready") {
					clearPendingReadingEvidence();
					setStatus("ready");
					return;
				}
				// decision === "initial": no previous story to finalize, so go
				// straight to preparing the first one.
				void runInitial();
			} catch (err) {
				console.warn("Could not read the prepared reading story queue.", err);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [run, runInitial]);

	const makeNextStory = useCallback(
		(evidence: StoryFinishEvidence) => {
			// Leaving the story and submitting feedback both finish the same story
			// and both land here; the first caller owns the lifecycle so the pair
			// cannot double-generate.
			if (runRef.current?.storyId === evidence.storyId) return;
			void run(evidence);
		},
		[run],
	);

	const retry = useCallback(() => {
		const pending = runRef.current ?? readPendingReadingEvidence();
		if (pending) {
			void run(pending);
			return;
		}
		void runInitial();
	}, [run, runInitial]);

	const markConsumed = useCallback(() => {
		clearPendingReadingEvidence();
		runRef.current = null;
		setStatus("idle");
	}, []);

	return {
		status,
		busy: isReadingPreparationBusy(status),
		makeNextStory,
		retry,
		markConsumed,
	};
}
