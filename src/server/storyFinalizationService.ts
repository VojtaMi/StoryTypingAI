import type OpenAI from "openai";
import type { LearnerLanguageProfile } from "../learnerState";
import { withAiTraceMetadata } from "./aiTrace";
import { enqueueLearnerProfileMutation } from "./learnerProfileMutationQueue";
import {
	refineLearnerStateFromStory,
	type StoryRecapEvidenceItem,
} from "./learnerProfileService";
import { readLearnerContext, writeLearnerContext } from "./learnerProfileStore";
import {
	advanceWordLogCursor,
	pruneWordLogForStory,
	readWordLookupsForStory,
	readWordLookupsSinceLastRefine,
} from "./learnerWordLogStore";
import {
	readFinishEvidence,
	updateFinishEvidence,
} from "./storyFinishEvidenceStore";

export interface StoryFinalizationInput {
	storyId: string;
	storySummary: string;
	languageFocus: string;
	learnerQuestions: string[];
	recapResults: StoryRecapEvidenceItem[];
	feedback?: string;
}

async function finalizeOnce(
	openai: OpenAI,
	evidence: StoryFinalizationInput,
	anthropicKey: string,
): Promise<LearnerLanguageProfile> {
	const record = await readFinishEvidence(evidence.storyId);
	// Finalization is resolved exactly once, at the moment the next story is
	// generated. A story that has already finalized ignores any later evidence:
	// there is no late-delta path, so a reopened story cannot re-refine the
	// profile behind a chain hint that was already bound.
	if (record.finalizedAt) {
		return (await readLearnerContext()).languageProfile;
	}

	const feedback = evidence.feedback?.trim() || undefined;
	const [current, scoped, unscoped] = await Promise.all([
		readLearnerContext(),
		readWordLookupsForStory(evidence.storyId),
		readWordLookupsSinceLastRefine(),
	]);
	const today = new Date().toISOString().slice(0, 10);
	const { context: updated, readingChain } = await refineLearnerStateFromStory(
		openai,
		current,
		{
			storySummary: evidence.storySummary,
			languageFocus: evidence.languageFocus,
			wordLookups: [...scoped.lookups, ...unscoped.lookups],
			learnerQuestions: evidence.learnerQuestions,
			recapResults: evidence.recapResults,
			feedback,
		},
		anthropicKey,
		today,
	);

	await writeLearnerContext(updated);
	await pruneWordLogForStory(evidence.storyId);
	if (unscoped.cursorCandidate) {
		await advanceWordLogCursor(unscoped.cursorCandidate);
	}
	await updateFinishEvidence(evidence.storyId, {
		finalizedAt: new Date().toISOString(),
		storySummary: evidence.storySummary,
		learnerQuestions: evidence.learnerQuestions,
		recapResults: evidence.recapResults,
		feedback,
		wordLookups: scoped.aggregated,
		globalWordLookups: unscoped.aggregated,
		// The transient chain hint rides in the reading-lifecycle record, keyed by
		// this story's id, for the next prepare to read via basedOnStoryId.
		...(readingChain ? { readingChain } : {}),
	});
	return updated.languageProfile;
}

export async function finalizeStoryEvidence(
	openai: OpenAI,
	evidence: StoryFinalizationInput,
	anthropicKey: string,
): Promise<LearnerLanguageProfile> {
	let result = (await readLearnerContext()).languageProfile;
	const task = enqueueLearnerProfileMutation(() =>
		withAiTraceMetadata(
			{ storyId: evidence.storyId, storyPhase: "finalize" },
			async () => {
				result = await finalizeOnce(openai, evidence, anthropicKey);
			},
		),
	);
	try {
		await task;
	} catch (err) {
		console.warn("Could not finalize reading story evidence.", err);
	}
	return result;
}
