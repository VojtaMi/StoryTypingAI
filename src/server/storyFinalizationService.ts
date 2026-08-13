import type OpenAI from "openai";
import { mergeStoryMemory } from "../learnerState";
import {
	type NextStoryBrief,
	STARTER_NEXT_STORY_BRIEF,
} from "../nextStoryBrief";
import type { StoryDifficulty } from "../storyFeedback";
import { withAiTraceMetadata } from "./aiTrace";
import { enqueueLearnerProfileMutation } from "./learnerProfileMutationQueue";
import type { StoryRecapEvidenceItem } from "./learnerProfileService";
import { readLearnerContext, writeLearnerContext } from "./learnerProfileStore";
import {
	pruneWordLogForStory,
	readWordLookupsForStory,
} from "./learnerWordLogStore";
import { generateNextStoryBrief } from "./nextStoryBriefService";
import {
	readFinishEvidence,
	updateFinishEvidence,
} from "./storyFinishEvidenceStore";

export interface StoryFinalizationInput {
	storyId: string;
	storySummary: string;
	storyParts: string[];
	languageFocus: string;
	generationBrief?: NextStoryBrief;
	learnerQuestions: string[];
	recapResults: StoryRecapEvidenceItem[];
	difficulty?: StoryDifficulty;
	practiceRequest?: string;
}

const finalizationTasks = new Map<string, Promise<NextStoryBrief>>();

async function finalizeOnce(
	openai: OpenAI,
	evidence: StoryFinalizationInput,
	anthropicKey: string,
): Promise<NextStoryBrief> {
	const record = await readFinishEvidence(evidence.storyId);
	// Finalization is resolved exactly once, at the moment the next story is
	// generated. A story that has already finalized ignores later evidence so a
	// reopened story cannot replace the handoff already bound to its successor.
	if (record.finalizedAt) {
		return record.nextStoryBrief ?? STARTER_NEXT_STORY_BRIEF;
	}

	const practiceRequest = evidence.practiceRequest?.trim() || undefined;
	const [scoped, learnerContext] = await Promise.all([
		readWordLookupsForStory(evidence.storyId),
		readLearnerContext(),
	]);
	const handoff = await generateNextStoryBrief(
		openai,
		{
			storySummary: evidence.storySummary,
			storyParts: evidence.storyParts,
			languageFocus: evidence.languageFocus,
			wordLookups: scoped.lookups,
			learnerQuestions: evidence.learnerQuestions,
			recapResults: evidence.recapResults,
			recentStories: learnerContext.storyMemory.recentStories,
			difficulty: evidence.difficulty,
			practiceRequest,
		},
		anthropicKey,
		evidence.generationBrief,
	);
	const { nextStoryBrief, recentStory } = handoff;
	if (recentStory) {
		await enqueueLearnerProfileMutation(async () => {
			const current = await readLearnerContext();
			const storyMemory = mergeStoryMemory(
				current.storyMemory,
				recentStory,
				new Date().toISOString().slice(0, 10),
			);
			await writeLearnerContext({ ...current, storyMemory });
		});
	}

	await pruneWordLogForStory(evidence.storyId);
	await updateFinishEvidence(evidence.storyId, {
		finalizedAt: new Date().toISOString(),
		storySummary: evidence.storySummary,
		learnerQuestions: evidence.learnerQuestions,
		recapResults: evidence.recapResults,
		difficulty: evidence.difficulty,
		practiceRequest,
		wordLookups: scoped.aggregated,
		// The self-contained handoff rides in the reading-lifecycle record, keyed
		// by this story for the next preparation to consume.
		nextStoryBrief,
	});
	return nextStoryBrief;
}

export async function finalizeStoryEvidence(
	openai: OpenAI,
	evidence: StoryFinalizationInput,
	anthropicKey: string,
): Promise<NextStoryBrief> {
	const existing = finalizationTasks.get(evidence.storyId);
	if (existing) return existing;
	const task = withAiTraceMetadata(
		{ storyId: evidence.storyId, storyPhase: "finalize" },
		() => finalizeOnce(openai, evidence, anthropicKey),
	).finally(() => {
		finalizationTasks.delete(evidence.storyId);
	});
	finalizationTasks.set(evidence.storyId, task);
	return task;
}
