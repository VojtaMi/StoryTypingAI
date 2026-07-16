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
	learnerQuestions: string[];
	recapResults: StoryRecapEvidenceItem[];
	feedback?: string;
}

async function applyLateEvidence(
	openai: OpenAI,
	storySummary: string,
	learnerQuestions: string[],
	feedback: string | undefined,
	anthropicKey: string,
): Promise<LearnerLanguageProfile> {
	const current = await readLearnerContext();
	const today = new Date().toISOString().slice(0, 10);
	const updated = await refineLearnerStateFromStory(
		openai,
		current,
		{ storySummary, learnerQuestions, feedback },
		"delta",
		anthropicKey,
		today,
	);
	await writeLearnerContext(updated);
	return updated.languageProfile;
}

async function finalizeOnce(
	openai: OpenAI,
	evidence: StoryFinalizationInput,
	anthropicKey: string,
): Promise<LearnerLanguageProfile> {
	const record = await readFinishEvidence(evidence.storyId);
	const incomingQuestions = evidence.learnerQuestions;
	const storedQuestions = record.learnerQuestions ?? [];
	const newQuestions = incomingQuestions.filter(
		(question) => !storedQuestions.includes(question),
	);
	const feedback = evidence.feedback?.trim() || undefined;
	const newFeedback =
		feedback !== undefined && feedback !== record.feedback
			? feedback
			: undefined;

	if (record.finalizedAt) {
		if (!newQuestions.length && newFeedback === undefined) {
			return (await readLearnerContext()).languageProfile;
		}
		const updated = await applyLateEvidence(
			openai,
			record.storySummary ?? evidence.storySummary,
			newQuestions,
			newFeedback,
			anthropicKey,
		);
		await updateFinishEvidence(evidence.storyId, {
			learnerQuestions: [...storedQuestions, ...newQuestions],
			...(newFeedback !== undefined ? { feedback: newFeedback } : {}),
		});
		return updated;
	}

	const [current, scoped, unscoped] = await Promise.all([
		readLearnerContext(),
		readWordLookupsForStory(evidence.storyId),
		readWordLookupsSinceLastRefine(),
	]);
	const today = new Date().toISOString().slice(0, 10);
	const updated = await refineLearnerStateFromStory(
		openai,
		current,
		{
			storySummary: evidence.storySummary,
			wordLookups: [...scoped.lookups, ...unscoped.lookups],
			learnerQuestions: incomingQuestions,
			recapResults: evidence.recapResults,
			feedback,
		},
		"story",
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
		learnerQuestions: incomingQuestions,
		recapResults: evidence.recapResults,
		feedback,
		wordLookups: scoped.aggregated,
		globalWordLookups: unscoped.aggregated,
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
