import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The story-finish evidence manager's correctness lives in two stores: word
 * lookups are attributed to the story they happened in (so a delayed baseline
 * can't consume another story's lookups), and the per-story finalization record
 * makes finalization idempotent. Both are pure filesystem logic — no provider —
 * so these assert the properties directly. The refine handlers are thin
 * orchestration over them.
 *
 * The stores resolve `learner/` and `stories/` from process.cwd() at import
 * time, so we chdir into a scratch directory before importing them.
 */
const originalCwd = process.cwd();
const workDir = await mkdtemp(join(tmpdir(), "finish-evidence-"));
process.chdir(workDir);

const {
	appendLearnerWordLogEntry,
	readWordLookupsForStory,
	readWordLookupsSinceLastRefine,
	pruneWordLogForStory,
	advanceWordLogCursor,
} = await import("../src/server/learnerWordLogStore.ts");
const { readFinishEvidence, updateFinishEvidence } = await import(
	"../src/server/storyFinishEvidenceStore.ts"
);
const { writeLearnerProfile, writeStoryMemory } = await import(
	"../src/server/learnerProfileStore.ts"
);
const { finalizeStoryEvidence } = await import(
	"../src/server/storyFinalizationService.ts"
);
const { enqueueLearnerProfileMutation } = await import(
	"../src/server/learnerProfileMutationQueue.ts"
);

const storyA = "story-a--0001";
const storyB = "story-b--0002";
const storyC = "story-c--0003";

const profile = `---
type: learner-language-profile
title: Esperanto learner language profile
level: beginner
updated: 2026-07-16
---

# Confident
Existing.

# Currently learning (their edge)
Existing.

# Shaky / watch for
Existing.

# Recently practiced
Existing.

# About this learner
Existing.
`;
const storyMemory = `---
type: story-memory
title: Recent Esperanto story motifs
updated: 2026-07-16
---

# Recently used motifs
Existing.

# Recently used objects and settings
Existing.

# Avoid next
Existing.
`;

try {
	// --- Word-log scoping ---------------------------------------------------
	// One unscoped (menu/standalone) lookup, story A looked up twice, story B once.
	await appendLearnerWordLogEntry("libro"); // unscoped
	await appendLearnerWordLogEntry("hundo", storyA);
	await appendLearnerWordLogEntry("hundo", storyA);
	await appendLearnerWordLogEntry("kato", storyB);

	const aLookups = await readWordLookupsForStory(storyA);
	assert.deepEqual(aLookups.aggregated, [{ word: "hundo", count: 2 }]);
	assert.deepEqual(aLookups.lookups, ["hundo (2x)"]);
	console.log("checked word-log: story A gets only its own aggregated lookups");

	const bLookups = await readWordLookupsForStory(storyB);
	assert.deepEqual(bLookups.aggregated, [{ word: "kato", count: 1 }]);

	// The global (unscoped) path must NOT see either story's scoped lookups.
	const unscoped = await readWordLookupsSinceLastRefine();
	assert.deepEqual(unscoped.aggregated, [{ word: "libro", count: 1 }]);
	assert.ok(unscoped.cursorCandidate, "unscoped summary carries a cursor");
	console.log(
		"checked word-log: global cursor path sees only unscoped lookups",
	);

	// --- Story A finalizes before B; B's lookup stays attributed to B -------
	// This is the leak the manager exists to prevent: A consuming B's lookups.
	await pruneWordLogForStory(storyA);
	assert.deepEqual(
		(await readWordLookupsForStory(storyA)).aggregated,
		[],
		"A's scoped lookups are consumed by its own finalization",
	);
	assert.deepEqual(
		(await readWordLookupsForStory(storyB)).aggregated,
		[{ word: "kato", count: 1 }],
		"B's lookup remains attributed to B after A finalizes",
	);
	console.log(
		"checked word-log: A finalizing leaves B's lookup attributed to B",
	);

	// Advancing the global cursor (unscoped consumed) also must not touch B.
	if (unscoped.cursorCandidate) {
		await advanceWordLogCursor(unscoped.cursorCandidate);
	}
	assert.deepEqual((await readWordLookupsSinceLastRefine()).aggregated, []);
	assert.deepEqual((await readWordLookupsForStory(storyB)).aggregated, [
		{ word: "kato", count: 1 },
	]);
	console.log(
		"checked word-log: advancing the global cursor leaves B untouched",
	);

	// --- Finish-evidence record: complete evidence and idempotence ------------
	const bare = await readFinishEvidence(storyA);
	assert.deepEqual(bare, { storyId: storyA }, "unknown story → bare record");

	await updateFinishEvidence(storyA, {
		finalizedAt: "2026-07-16T00:00:00.000Z",
		storySummary: "a summary",
		learnerQuestions: ["What does hundo mean?"],
		recapResults: [
			{ type: "word-connect", label: "hundo = hundred", attempts: 1 },
		],
		feedback: "just right",
		wordLookups: [{ word: "hundo", count: 2 }],
		globalWordLookups: [{ word: "libro", count: 1 }],
	});
	// A repeated finalization must retain the complete original evidence.
	const merged = await updateFinishEvidence(storyA, {
		learnerQuestions: ["What does hundo mean?", "Why is it hundo?"],
		feedback: "a little hard",
	});
	assert.equal(merged.finalizedAt, "2026-07-16T00:00:00.000Z");
	assert.deepEqual(merged.learnerQuestions, [
		"What does hundo mean?",
		"Why is it hundo?",
	]);
	assert.equal(merged.feedback, "a little hard");
	assert.deepEqual(merged.recapResults, [
		{ type: "word-connect", label: "hundo = hundred", attempts: 1 },
	]);
	assert.equal(merged.storySummary, "a summary");
	assert.deepEqual(merged.wordLookups, [{ word: "hundo", count: 2 }]);
	assert.deepEqual(merged.globalWordLookups, [{ word: "libro", count: 1 }]);

	const reread = await readFinishEvidence(storyA);
	assert.deepEqual(reread, merged, "the merged record persists to disk");
	console.log("checked finish-evidence: updates merge and persist");

	// Concurrent updates to the same story serialize instead of clobbering.
	await Promise.all([
		updateFinishEvidence(storyB, { finalizedAt: "t1" }),
		updateFinishEvidence(storyB, {
			learnerQuestions: ["late question"],
			feedback: "just right",
		}),
	]);
	const bRecord = await readFinishEvidence(storyB);
	assert.equal(bRecord.finalizedAt, "t1");
	assert.deepEqual(bRecord.learnerQuestions, ["late question"]);
	assert.equal(bRecord.feedback, "just right");
	console.log(
		"checked finish-evidence: concurrent updates to one story serialize",
	);

	// --- Service-level finalization -----------------------------------------
	process.env.OPENAI_API_KEY = "test-key";
	await writeLearnerProfile(profile);
	await writeStoryMemory(storyMemory);
	let refinementCalls = 0;
	const fakeOpenai = {
		chat: {
			completions: {
				create: async ({
					messages,
				}: {
					messages: Array<{ content: string }>;
				}) => {
					refinementCalls += 1;
					const isMemory = messages[0]?.content.includes("story-generation");
					return {
						choices: [
							{
								message: { content: isMemory ? storyMemory : profile },
							},
						],
					};
				},
			},
		},
	} as never;
	const evidence = {
		storyId: storyC,
		storySummary: "A learner visits a quiet workshop.",
		learnerQuestions: ["What does ilo mean?"],
		recapResults: [{ type: "word-connect", label: "ilo = tool", attempts: 1 }],
		feedback: "just right",
	};
	await finalizeStoryEvidence(fakeOpenai, evidence, "");
	assert.equal(
		refinementCalls,
		2,
		"first finalization refines profile and memory",
	);
	const firstRecord = await readFinishEvidence(storyC);
	assert.ok(firstRecord.finalizedAt);
	assert.deepEqual(firstRecord.learnerQuestions, evidence.learnerQuestions);
	assert.deepEqual(firstRecord.recapResults, evidence.recapResults);
	assert.equal(firstRecord.feedback, "just right");

	await finalizeStoryEvidence(fakeOpenai, evidence, "");
	assert.equal(refinementCalls, 2, "identical finalization is a no-op");
	await finalizeStoryEvidence(
		fakeOpenai,
		{
			...evidence,
			learnerQuestions: [...evidence.learnerQuestions, "Why ilo?"],
		},
		"",
	);
	assert.equal(refinementCalls, 3, "a late question applies one profile delta");
	await finalizeStoryEvidence(
		fakeOpenai,
		{
			...evidence,
			learnerQuestions: [...evidence.learnerQuestions, "Why ilo?"],
		},
		"",
	);
	assert.equal(
		refinementCalls,
		3,
		"omitting existing feedback adds no evidence",
	);
	console.log(
		"checked finalization service: full evidence, idempotence, and late deltas",
	);

	const queueEvents: string[] = [];
	await Promise.all([
		enqueueLearnerProfileMutation(async () => {
			queueEvents.push("chat-start");
			await new Promise((resolve) => setTimeout(resolve, 5));
			queueEvents.push("chat-end");
		}),
		enqueueLearnerProfileMutation(async () => {
			queueEvents.push("story");
		}),
	]);
	assert.deepEqual(queueEvents, ["chat-start", "chat-end", "story"]);
	console.log(
		"checked shared profile queue: chat and story mutations serialize",
	);

	console.log("\nstory-finish evidence checks passed");
} finally {
	process.chdir(originalCwd);
	await rm(workDir, { recursive: true, force: true });
}
