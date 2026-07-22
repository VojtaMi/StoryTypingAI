import { useCallback, useRef, useState } from "react";
import {
	EMPTY_STORY_FEEDBACK,
	formatStoryFeedback,
	hasStoryFeedback,
	type StoryDifficulty,
	type StoryFeedbackRecord,
} from "../storyFeedback";

/**
 * What the learner said about a finished reading story, in the shape the
 * finalization lifecycle consumes. Every field is optional: leaving the
 * completion screen without touching the form is a genuine skip, not an error.
 *
 * The fields stay separate rather than being flattened into one sentence,
 * because each has a different destination on the server.
 */
export interface ResolvedStoryFeedback {
	difficulty?: StoryDifficulty;
	taste?: string;
	practiceRequest?: string;
	nextStoryTheme?: string;
}

/** The feedback fields a story save persists, for showing on a reread. */
export interface StoryFeedbackSnapshot {
	storyFeedback?: string;
	storyFeedbackSubmittedAt?: string;
}

interface StoryFeedbackResolution {
	record: StoryFeedbackRecord;
	submittedAt: string | null;
}

const EMPTY_RESOLUTION: StoryFeedbackResolution = {
	record: EMPTY_STORY_FEEDBACK,
	submittedAt: null,
};

export interface StoryFeedback {
	/**
	 * True only for a story just finished in this live session, which is the only
	 * time the feedback form is submittable. A reopened/reread finished save is
	 * read-only: it may show a prior rating but can never re-resolve feedback
	 * behind a chain hint that has already been bound.
	 */
	editable: boolean;
	/** A readable summary of the resolved feedback, for the read-only reread panel. */
	feedback: string | null;
	submittedAt: string | null;
	/** The live form reports its current contents here as they change. */
	reportDraft: (record: StoryFeedbackRecord) => void;
	/** Explicit Submit: resolves the values now and stamps the resolution time. */
	submit: (record: StoryFeedbackRecord) => ResolvedStoryFeedback;
	/**
	 * The single definition of "whatever is on the completion screen": the live
	 * draft wins, falling back to anything already resolved. Both leaving the
	 * screen and submitting resolve through here, so feedback has exactly one
	 * resolution rule rather than one per call site.
	 */
	resolve: () => ResolvedStoryFeedback;
	/** A story just finished live: a fresh, submittable form. */
	beginLiveFinish: () => void;
	/** A reopened finished save: read-only, showing only what was recorded before. */
	loadFromSave: (feedback: string | null, submittedAt: string | null) => void;
	/** Clear everything when the session moves to a different story. */
	reset: () => void;
	/** Current resolved values, for the save snapshot. */
	readSnapshot: () => StoryFeedbackSnapshot;
}

/**
 * Owns the reading story's end-of-story feedback: the live form draft, the
 * resolved values, and whether the form may be submitted at all.
 *
 * The invariant this exists to hold is that feedback is resolved exactly once,
 * at the moment the next story is generated, from whatever is on the completion
 * screen. {@link StoryFeedback.resolve} is the only place that decides what
 * "resolved" means, and submitting runs that same resolution, so the two paths
 * cannot drift apart — which is how typed-but-unsubmitted feedback used to be
 * dropped.
 */
export function useStoryFeedback(): StoryFeedback {
	const [editable, setEditable] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);
	const [submittedAt, setSubmittedAt] = useState<string | null>(null);

	const draftRef = useRef<StoryFeedbackRecord>(EMPTY_STORY_FEEDBACK);
	const resolutionRef = useRef<StoryFeedbackResolution>(EMPTY_RESOLUTION);
	// A save only keeps the readable summary, so a reopened story can show what
	// was said without the structured record being reconstructable from it.
	const savedSummaryRef = useRef<string | null>(null);

	const reportDraft = useCallback((record: StoryFeedbackRecord) => {
		draftRef.current = record;
	}, []);

	const resolve = useCallback((): ResolvedStoryFeedback => {
		const draft = draftRef.current;
		const previous = resolutionRef.current;
		const record = hasStoryFeedback(draft) ? draft : previous.record;
		if (hasStoryFeedback(record)) {
			resolutionRef.current = {
				record,
				submittedAt: previous.submittedAt ?? new Date().toISOString(),
			};
		}
		return {
			difficulty: record.difficulty ?? undefined,
			taste: record.taste.trim() || undefined,
			practiceRequest: record.practiceRequest.trim() || undefined,
			nextStoryTheme: record.nextStoryTheme.trim() || undefined,
		};
	}, []);

	const submit = useCallback(
		(record: StoryFeedbackRecord): ResolvedStoryFeedback => {
			// Submitting is not a second way to resolve feedback, only an earlier and
			// explicit one: put the values on the draft and run the same resolution
			// leaving the screen would run, so the two can never disagree.
			reportDraft(record);
			const resolved = resolve();
			setFeedback(formatStoryFeedback(resolutionRef.current.record) || null);
			setSubmittedAt(resolutionRef.current.submittedAt);
			return resolved;
		},
		[reportDraft, resolve],
	);

	const beginLiveFinish = useCallback(() => {
		draftRef.current = EMPTY_STORY_FEEDBACK;
		savedSummaryRef.current = null;
		setFeedback(null);
		setEditable(true);
	}, []);

	const loadFromSave = useCallback(
		(savedFeedback: string | null, savedSubmittedAt: string | null) => {
			draftRef.current = EMPTY_STORY_FEEDBACK;
			// The structured record is not recoverable from a save, only its summary,
			// so keep the stamp here and let the summary ride alongside it. Persisting
			// a reopened story must not wipe either.
			resolutionRef.current = {
				record: EMPTY_STORY_FEEDBACK,
				submittedAt: savedSubmittedAt,
			};
			savedSummaryRef.current = savedFeedback;
			setFeedback(savedFeedback);
			setSubmittedAt(savedSubmittedAt);
			setEditable(false);
		},
		[],
	);

	const reset = useCallback(() => {
		draftRef.current = EMPTY_STORY_FEEDBACK;
		resolutionRef.current = EMPTY_RESOLUTION;
		savedSummaryRef.current = null;
		setFeedback(null);
		setSubmittedAt(null);
		setEditable(false);
	}, []);

	const readSnapshot = useCallback((): StoryFeedbackSnapshot => {
		const summary =
			formatStoryFeedback(resolutionRef.current.record) ||
			savedSummaryRef.current ||
			"";
		return {
			storyFeedback: summary || undefined,
			storyFeedbackSubmittedAt: resolutionRef.current.submittedAt ?? undefined,
		};
	}, []);

	return {
		editable,
		feedback,
		submittedAt,
		reportDraft,
		submit,
		resolve,
		beginLiveFinish,
		loadFromSave,
		reset,
		readSnapshot,
	};
}
