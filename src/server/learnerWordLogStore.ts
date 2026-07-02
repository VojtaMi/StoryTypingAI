import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface LearnerWordLogEntry {
	word: string;
	timestamp: string;
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

export async function appendLearnerWordLogEntry(word: string): Promise<void> {
	writeQueue = writeQueue
		.catch(() => undefined)
		.then(async () => {
			const log = await readWordLog();
			log.push({ word, timestamp: new Date().toISOString() });
			await mkdir(learnerDir, { recursive: true });
			await writeFile(wordLogPath, `${JSON.stringify(log, null, 2)}\n`, "utf8");
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

export interface WordLookupSummary {
	lookups: string[];
	/** Max timestamp among the entries this summary covers, or null if none. Pass to {@link advanceWordLogCursor} once the caller has durably used this summary. */
	cursorCandidate: string | null;
}

/**
 * Aggregates word-log clicks since the last time the profile was refined from
 * a finished story. Does not advance the cursor itself — call
 * {@link advanceWordLogCursor} with the returned cursorCandidate only after the
 * evidence has been durably folded into the profile, so a failed refine or
 * write doesn't silently lose these lookups. Repeated lookups sort first,
 * since VISION.md treats repeat clicks as stronger evidence than a single
 * click.
 */
export async function readWordLookupsSinceLastRefine(): Promise<WordLookupSummary> {
	const [log, cursor] = await Promise.all([readWordLog(), readWordLogCursor()]);
	const relevant = cursor
		? log.filter((entry) => entry.timestamp > cursor)
		: log;
	if (relevant.length === 0) return { lookups: [], cursorCandidate: null };

	const counts = new Map<string, number>();
	let maxTimestamp = relevant[0].timestamp;
	for (const entry of relevant) {
		counts.set(entry.word, (counts.get(entry.word) ?? 0) + 1);
		if (entry.timestamp > maxTimestamp) maxTimestamp = entry.timestamp;
	}

	const lookups = [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, MAX_WORD_LOOKUP_SUMMARY)
		.map(([word, count]) => `${word} (${count}x)`);
	return { lookups, cursorCandidate: maxTimestamp };
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
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as LearnerWordLogEntry).word === "string" &&
		typeof (value as LearnerWordLogEntry).timestamp === "string"
	);
}
