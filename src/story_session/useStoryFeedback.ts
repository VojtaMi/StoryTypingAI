import { useCallback, useEffect, useRef, useState } from "react";

/**
 * What the learner said about a finished reading story, resolved into the shape
 * the finalization lifecycle consumes. Every field is optional: leaving the
 * completion screen without touching the form is a genuine skip, not an error.
 */
export interface ResolvedStoryFeedback {
	feedback?: string;
	nextStoryTheme?: string;
	practiceRequest?: string;
}

/** The feedback fields a story save persists. */
export interface StoryFeedbackSnapshot {
	storyFeedback?: string;
	storyFeedbackSubmittedAt?: string;
}

export interface StoryFeedback {
	/**
	 * True only for a story just finished in this live session, which is the only
	 * time the feedback form is submittable. A reopened/reread finished save is
	 * read-only: it may show a prior rating but can never re-resolve feedback
	 * behind a chain hint that has already been bound.
	 */
	editable: boolean;
	/** The resolved feedback text, kept reactive so a reread can display it. */
	feedback: string | null;
	submittedAt: string | null;
	/** The live form reports its current contents here as they change. */
	reportDraft: (
		feedback: string,
		nextStoryTheme: string,
		practiceRequest: string,
	) => void;
	/** Explicit Submit: records the values and stamps the resolution time. */
	submit: (
		feedback: string,
		nextStoryTheme: string,
		practiceRequest: string,
	) => ResolvedStoryFeedback;
	/**
	 * The single definition of "whatever is on the completion screen": the live
	 * draft wins, falling back to anything already submitted. Both leaving the
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
 * "resolved" means, so leaving the screen and pressing Submit cannot drift
 * apart — which is how typed-but-unsubmitted feedback used to be dropped.
 */
export function useStoryFeedback(): StoryFeedback {
	const [editable, setEditable] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);
	const [submittedAt, setSubmittedAt] = useState<string | null>(null);

	const feedbackRef = useRef<string | null>(null);
	const submittedAtRef = useRef<string | null>(null);
	const nextThemeRef = useRef<string | null>(null);
	const feedbackDraftRef = useRef("");
	const themeDraftRef = useRef("");
	const practiceDraftRef = useRef("");

	useEffect(() => {
		submittedAtRef.current = submittedAt;
	}, [submittedAt]);

	const clearDrafts = useCallback(() => {
		feedbackDraftRef.current = "";
		themeDraftRef.current = "";
		practiceDraftRef.current = "";
	}, []);

	const reportDraft = useCallback(
		(nextFeedback: string, nextStoryTheme: string, practiceRequest: string) => {
			feedbackDraftRef.current = nextFeedback;
			themeDraftRef.current = nextStoryTheme;
			practiceDraftRef.current = practiceRequest;
		},
		[],
	);

	const resolve = useCallback((): ResolvedStoryFeedback => {
		const draftFeedback = feedbackDraftRef.current.trim();
		const draftTheme = themeDraftRef.current.trim();
		const resolvedFeedback = draftFeedback || feedbackRef.current || undefined;
		const resolvedTheme = draftTheme || nextThemeRef.current || undefined;
		const resolvedPractice = practiceDraftRef.current.trim() || undefined;
		if (resolvedFeedback) {
			feedbackRef.current = resolvedFeedback;
			if (!submittedAtRef.current) {
				submittedAtRef.current = new Date().toISOString();
			}
		}
		return {
			feedback: resolvedFeedback,
			nextStoryTheme: resolvedTheme,
			practiceRequest: resolvedPractice,
		};
	}, []);

	const submit = useCallback(
		(
			nextFeedback: string,
			nextStoryTheme: string,
			practiceRequest: string,
		): ResolvedStoryFeedback => {
			const stamp = new Date().toISOString();
			const cleanFeedback = nextFeedback.trim();
			const cleanTheme = nextStoryTheme.trim();
			const cleanPractice = practiceRequest.trim();
			// Submitting is just an early, explicit resolution: fold the values into
			// the draft so `resolve` would produce the same answer afterwards.
			reportDraft(cleanFeedback, cleanTheme, cleanPractice);
			feedbackRef.current = cleanFeedback;
			nextThemeRef.current = cleanTheme || null;
			submittedAtRef.current = stamp;
			setFeedback(cleanFeedback);
			setSubmittedAt(stamp);
			return {
				feedback: cleanFeedback,
				nextStoryTheme: cleanTheme,
				practiceRequest: cleanPractice,
			};
		},
		[reportDraft],
	);

	const beginLiveFinish = useCallback(() => {
		clearDrafts();
		setFeedback(null);
		setEditable(true);
	}, [clearDrafts]);

	const loadFromSave = useCallback(
		(savedFeedback: string | null, savedSubmittedAt: string | null) => {
			feedbackRef.current = savedFeedback;
			submittedAtRef.current = savedSubmittedAt;
			setFeedback(savedFeedback);
			setSubmittedAt(savedSubmittedAt);
			setEditable(false);
			clearDrafts();
		},
		[clearDrafts],
	);

	const reset = useCallback(() => {
		feedbackRef.current = null;
		submittedAtRef.current = null;
		nextThemeRef.current = null;
		setFeedback(null);
		setSubmittedAt(null);
		setEditable(false);
		clearDrafts();
	}, [clearDrafts]);

	const readSnapshot = useCallback(
		(): StoryFeedbackSnapshot => ({
			storyFeedback: feedbackRef.current ?? undefined,
			storyFeedbackSubmittedAt: submittedAtRef.current ?? undefined,
		}),
		[],
	);

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
