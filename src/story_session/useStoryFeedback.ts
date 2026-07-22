import { useCallback, useRef, useState } from "react";

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

/** The live contents of the completion-screen form. */
interface StoryFeedbackDraft {
	feedback: string;
	nextStoryTheme: string;
	practiceRequest: string;
}

/** What has actually been resolved for this story, and when. */
interface StoryFeedbackResolution {
	feedback: string | null;
	nextStoryTheme: string | null;
	submittedAt: string | null;
}

const EMPTY_DRAFT: StoryFeedbackDraft = {
	feedback: "",
	nextStoryTheme: "",
	practiceRequest: "",
};

const EMPTY_RESOLUTION: StoryFeedbackResolution = {
	feedback: null,
	nextStoryTheme: null,
	submittedAt: null,
};

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

	const draftRef = useRef<StoryFeedbackDraft>(EMPTY_DRAFT);
	const resolutionRef = useRef<StoryFeedbackResolution>(EMPTY_RESOLUTION);

	const reportDraft = useCallback(
		(nextFeedback: string, nextStoryTheme: string, practiceRequest: string) => {
			draftRef.current = {
				feedback: nextFeedback,
				nextStoryTheme,
				practiceRequest,
			};
		},
		[],
	);

	const resolve = useCallback((): ResolvedStoryFeedback => {
		const draft = draftRef.current;
		const previous = resolutionRef.current;
		const resolvedFeedback =
			draft.feedback.trim() || previous.feedback || undefined;
		const resolvedTheme =
			draft.nextStoryTheme.trim() || previous.nextStoryTheme || undefined;
		const resolvedPractice = draft.practiceRequest.trim() || undefined;
		if (resolvedFeedback) {
			resolutionRef.current = {
				feedback: resolvedFeedback,
				nextStoryTheme: resolvedTheme ?? null,
				submittedAt: previous.submittedAt ?? new Date().toISOString(),
			};
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
			// Submitting is not a second way to resolve feedback, only an earlier and
			// explicit one: put the values on the draft and run the same resolution
			// leaving the screen would run, so the two can never disagree.
			reportDraft(
				nextFeedback.trim(),
				nextStoryTheme.trim(),
				practiceRequest.trim(),
			);
			const resolved = resolve();
			setFeedback(resolutionRef.current.feedback);
			setSubmittedAt(resolutionRef.current.submittedAt);
			return resolved;
		},
		[reportDraft, resolve],
	);

	const beginLiveFinish = useCallback(() => {
		draftRef.current = EMPTY_DRAFT;
		setFeedback(null);
		setEditable(true);
	}, []);

	const loadFromSave = useCallback(
		(savedFeedback: string | null, savedSubmittedAt: string | null) => {
			draftRef.current = EMPTY_DRAFT;
			resolutionRef.current = {
				feedback: savedFeedback,
				nextStoryTheme: null,
				submittedAt: savedSubmittedAt,
			};
			setFeedback(savedFeedback);
			setSubmittedAt(savedSubmittedAt);
			setEditable(false);
		},
		[],
	);

	const reset = useCallback(() => {
		draftRef.current = EMPTY_DRAFT;
		resolutionRef.current = EMPTY_RESOLUTION;
		setFeedback(null);
		setSubmittedAt(null);
		setEditable(false);
	}, []);

	const readSnapshot = useCallback(
		(): StoryFeedbackSnapshot => ({
			storyFeedback: resolutionRef.current.feedback ?? undefined,
			storyFeedbackSubmittedAt: resolutionRef.current.submittedAt ?? undefined,
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
