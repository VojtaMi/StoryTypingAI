import type OpenAI from "openai";
import { withAiTraceMetadata } from "./aiTrace";
import { enqueueLearnerProfileMutation } from "./learnerProfileMutationQueue";
import {
	refineLearnerProfileFromStory,
	refineStoryMemoryFromStory,
	type StoryRecapEvidenceItem,
} from "./learnerProfileService";
import {
	readLearnerProfile,
	readStoryMemory,
	writeLearnerProfile,
	writeStoryMemory,
} from "./learnerProfileStore";
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
): Promise<string> {
	const current = await readLearnerProfile();
	const today = new Date().toISOString().slice(0, 10);
	const updated = await refineLearnerProfileFromStory(
		openai,
		current,
		{ storySummary, learnerQuestions, feedback },
		anthropicKey,
		today,
	);
	await writeLearnerProfile(updated);
	return updated;
}

async function finalizeOnce(
	openai: OpenAI,
	evidence: StoryFinalizationInput,
	anthropicKey: string,
): Promise<string> {
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
			return readLearnerProfile();
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

	const [current, currentStoryMemory, scoped, unscoped] = await Promise.all([
		readLearnerProfile(),
		readStoryMemory(),
		readWordLookupsForStory(evidence.storyId),
		readWordLookupsSinceLastRefine(),
	]);
	const today = new Date().toISOString().slice(0, 10);
	const [updated, updatedStoryMemory] = await Promise.all([
		refineLearnerProfileFromStory(
			openai,
			current,
			{
				storySummary: evidence.storySummary,
				wordLookups: [...scoped.lookups, ...unscoped.lookups],
				learnerQuestions: incomingQuestions,
				recapResults: evidence.recapResults,
				feedback,
			},
			anthropicKey,
			today,
		),
		refineStoryMemoryFromStory(
			openai,
			currentStoryMemory,
			{ storySummary: evidence.storySummary },
			anthropicKey,
			today,
		),
	]);

	await writeLearnerProfile(updated);
	await writeStoryMemory(updatedStoryMemory);
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
	return updated;
}

export async function finalizeStoryEvidence(
	openai: OpenAI,
	evidence: StoryFinalizationInput,
	anthropicKey: string,
): Promise<string> {
	let result = await readLearnerProfile();
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
