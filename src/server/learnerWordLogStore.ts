import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface LearnerWordLogEntry {
	word: string;
	timestamp: string;
	/**
	 * The story the lookup happened in, when it happened during a reading story.
	 * Scoped lookups are folded by that story's baseline finalization and never
	 * by the global cursor, so a delayed finalization can't let one story consume
	 * another story's lookups. Menu / standalone-tutor lookups stay unscoped.
	 */
	storyId?: string;
}

const learnerDir = join(process.cwd(), "learner");
const wordLogPath = join(learnerDir, "word-log.json");
const wordLogCursorPath = join(learnerDir, "word-log-cursor.json");
const MAX_WORD_LOOKUP_SUMMARY = 20;

let writeQueue: Promise<void> = Promise.resolve();

async function readWordLog(): Promise<LearnerWordLogEntry[]> {
	try {
		const parsed = JSON.parse(await readFile(wordLogPath, "utf8")) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isLearnerWordLogEntry);
	} catch {
		return [];
	}
}

async function writeWordLog(log: LearnerWordLogEntry[]): Promise<void> {
	await mkdir(learnerDir, { recursive: true });
	await writeFile(wordLogPath, `${JSON.stringify(log, null, 2)}\n`, "utf8");
}

export async function appendLearnerWordLogEntry(
	word: string,
	storyId?: string,
): Promise<void> {
	writeQueue = writeQueue
		.catch(() => undefined)
		.then(async () => {
			const log = await readWordLog();
			log.push({
				word,
				timestamp: new Date().toISOString(),
				...(storyId ? { storyId } : {}),
			});
			await writeWordLog(log);
		});
	return writeQueue;
}

async function readWordLogCursor(): Promise<string | null> {
	try {
		const parsed = JSON.parse(await readFile(wordLogCursorPath, "utf8")) as {
			cursor?: string;
		};
		return typeof parsed.cursor === "string" ? parsed.cursor : null;
	} catch {
		return null;
	}
}

/** One word looked up, and how many times, formatted for both prompt and audit. */
export interface AggregatedLookups {
	/** Prompt-ready lines, repeats first: e.g. `hundo (3x)`. */
	lookups: string[];
	/** Structured counts for the finalization record's audit trail. */
	aggregated: { word: string; count: number }[];
}

function aggregate(entries: LearnerWordLogEntry[]): AggregatedLookups {
	const counts = new Map<string, number>();
	for (const entry of entries) {
		counts.set(entry.word, (counts.get(entry.word) ?? 0) + 1);
	}
	const sorted = [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, MAX_WORD_LOOKUP_SUMMARY);
	return {
		lookups: sorted.map(([word, count]) => `${word} (${count}x)`),
		aggregated: sorted.map(([word, count]) => ({ word, count })),
	};
}

export interface WordLookupSummary extends AggregatedLookups {
	/** Max timestamp among the entries this summary covers, or null if none. Pass to {@link advanceWordLogCursor} once the caller has durably used this summary. */
	cursorCandidate: string | null;
}

/**
 * Aggregates **unscoped** word-log clicks since the last time the profile was
 * refined from a finished story — menu / standalone-tutor lookups that belong to
 * no particular story. Story-scoped lookups are deliberately excluded here; they
 * are folded only by {@link readWordLookupsForStory} at their own story's
 * finalization. Does not advance the cursor itself — call
 * {@link advanceWordLogCursor} with the returned cursorCandidate only after the
 * evidence has been durably folded into the profile. Repeated lookups sort
 * first, since repeat clicks are stronger evidence than a single click.
 */
export async function readWordLookupsSinceLastRefine(): Promise<WordLookupSummary> {
	const [log, cursor] = await Promise.all([readWordLog(), readWordLogCursor()]);
	const relevant = log.filter(
		(entry) =>
			entry.storyId === undefined && (!cursor || entry.timestamp > cursor),
	);
	if (relevant.length === 0) {
		return { lookups: [], aggregated: [], cursorCandidate: null };
	}

	let maxTimestamp = relevant[0].timestamp;
	for (const entry of relevant) {
		if (entry.timestamp > maxTimestamp) maxTimestamp = entry.timestamp;
	}

	return { ...aggregate(relevant), cursorCandidate: maxTimestamp };
}

/**
 * Aggregates the word lookups that happened during one specific reading story.
 * Used by that story's baseline finalization, which runs at most once (guarded
 * by the finish-evidence record). The global cursor is never touched by this
 * path, so this story's lookups can never be attributed to another story.
 */
export async function readWordLookupsForStory(
	storyId: string,
): Promise<AggregatedLookups> {
	const log = await readWordLog();
	return aggregate(log.filter((entry) => entry.storyId === storyId));
}

/**
 * Removes one story's scoped entries from the log once its baseline has folded
 * them in. Hygiene only: correctness comes from the baseline running once, not
 * from pruning. Unscoped entries and other stories' entries are left untouched.
 */
export async function pruneWordLogForStory(storyId: string): Promise<void> {
	writeQueue = writeQueue
		.catch(() => undefined)
		.then(async () => {
			const log = await readWordLog();
			const kept = log.filter((entry) => entry.storyId !== storyId);
			if (kept.length !== log.length) await writeWordLog(kept);
		});
	return writeQueue;
}

export async function advanceWordLogCursor(cursor: string): Promise<void> {
	await mkdir(learnerDir, { recursive: true });
	await writeFile(
		wordLogCursorPath,
		`${JSON.stringify({ cursor }, null, 2)}\n`,
		"utf8",
	);
}

function isLearnerWordLogEntry(value: unknown): value is LearnerWordLogEntry {
	if (
		typeof value !== "object" ||
		value === null ||
		typeof (value as LearnerWordLogEntry).word !== "string" ||
		typeof (value as LearnerWordLogEntry).timestamp !== "string"
	) {
		return false;
	}
	const storyId = (value as LearnerWordLogEntry).storyId;
	return storyId === undefined || typeof storyId === "string";
}
