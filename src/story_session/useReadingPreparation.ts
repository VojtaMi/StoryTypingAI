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
	const settle = (status: "ready" | "error") => {
		setStatus(status);
		return status;
	};

	setStatus("finalizing");
	try {
		await finalize();
	} catch (err) {
		// Preparing anyway would generate the next story from the state
		// finalization was meant to update — the exact repetition this lifecycle
		// exists to prevent. Surface a retry instead.
		console.warn("Could not finalize reading story evidence.", err);
		return settle("error");
	}
	setStatus("preparing");
	try {
		const prepared = await prepare();
		return settle(prepared.length > 0 ? "ready" : "error");
	} catch (err) {
		console.warn("Could not prepare the next reading story.", err);
		return settle("error");
	}
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
 */
export function decideReadingPreparationOnLoad({
	preparedCount,
	hasPendingEvidence,
}: {
	preparedCount: number;
	hasPendingEvidence: boolean;
}): "ready" | "resume" | "idle" {
	// A queued story means the lifecycle got there, whoever finished it.
	if (preparedCount > 0) return "ready";
	if (hasPendingEvidence) return "resume";
	return "idle";
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
	/** Re-run a lifecycle that failed. Finalization is idempotent server-side. */
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
				if (decision === "ready") clearPendingReadingEvidence();
				setStatus(decision === "ready" ? "ready" : "idle");
			} catch (err) {
				console.warn("Could not read the prepared reading story queue.", err);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [run]);

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
		if (!pending) return;
		void run(pending);
	}, [run]);

	const markConsumed = useCallback(() => {
		clearPendingReadingEvidence();
		runRef.current = null;
		setStatus("idle");
	}, []);

	return {
		status,
		busy: status === "finalizing" || status === "preparing",
		makeNextStory,
		retry,
		markConsumed,
	};
}
