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

const storyA = "story-a--0001";
const storyB = "story-b--0002";

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

	// --- Finish-evidence record: idempotent merge ---------------------------
	const bare = await readFinishEvidence(storyA);
	assert.deepEqual(bare, { storyId: storyA }, "unknown story → bare record");

	await updateFinishEvidence(storyA, {
		baselineRefinedAt: "2026-07-16T00:00:00.000Z",
		storySummary: "a summary",
		wordLookups: [{ word: "hundo", count: 2 }],
		globalWordLookups: [{ word: "libro", count: 1 }],
	});
	// A later feedback update must merge, not clobber the baseline stamp.
	const merged = await updateFinishEvidence(storyA, {
		feedbackRefinedAt: "2026-07-16T01:00:00.000Z",
		appliedFeedback: "too hard",
	});
	assert.equal(merged.baselineRefinedAt, "2026-07-16T00:00:00.000Z");
	assert.equal(merged.feedbackRefinedAt, "2026-07-16T01:00:00.000Z");
	assert.equal(merged.appliedFeedback, "too hard");
	assert.equal(merged.storySummary, "a summary");
	assert.deepEqual(merged.wordLookups, [{ word: "hundo", count: 2 }]);
	assert.deepEqual(merged.globalWordLookups, [{ word: "libro", count: 1 }]);

	const reread = await readFinishEvidence(storyA);
	assert.deepEqual(reread, merged, "the merged record persists to disk");
	console.log("checked finish-evidence: updates merge and persist");

	// Concurrent updates to the same story serialize instead of clobbering.
	await Promise.all([
		updateFinishEvidence(storyB, { baselineRefinedAt: "t1" }),
		updateFinishEvidence(storyB, {
			recapRefinedAt: "t2",
			recapResultsHash: "h",
		}),
	]);
	const bRecord = await readFinishEvidence(storyB);
	assert.equal(bRecord.baselineRefinedAt, "t1");
	assert.equal(bRecord.recapRefinedAt, "t2");
	assert.equal(bRecord.recapResultsHash, "h");
	console.log(
		"checked finish-evidence: concurrent updates to one story serialize",
	);

	console.log("\nstory-finish evidence checks passed");
} finally {
	process.chdir(originalCwd);
	await rm(workDir, { recursive: true, force: true });
}
