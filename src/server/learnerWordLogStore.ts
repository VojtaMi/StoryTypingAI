import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface LearnerWordLogEntry {
	word: string;
	timestamp: string;
}

const learnerDir = join(process.cwd(), "learner");
const wordLogPath = join(learnerDir, "word-log.json");

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

function isLearnerWordLogEntry(value: unknown): value is LearnerWordLogEntry {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as LearnerWordLogEntry).word === "string" &&
		typeof (value as LearnerWordLogEntry).timestamp === "string"
	);
}
