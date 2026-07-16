import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	DEFAULT_LEARNER_CONTEXT,
	type LearnerContext,
	parseLearnerContext,
} from "../learnerState";

const learnerDir = join(process.cwd(), "learner");
const statePath = join(learnerDir, "state.json");
const temporaryStatePath = join(learnerDir, "state.json.tmp");

export async function readLearnerContext(): Promise<LearnerContext> {
	try {
		const raw = await readFile(statePath, "utf8");
		const parsed = parseLearnerContext(JSON.parse(raw));
		if (parsed) return parsed;
		console.warn("Ignoring invalid learner/state.json; using default state.");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			console.warn(
				"Could not read learner/state.json; using default state.",
				error,
			);
		}
	}
	return structuredClone(DEFAULT_LEARNER_CONTEXT);
}

export async function writeLearnerContext(
	context: LearnerContext,
): Promise<void> {
	const valid = parseLearnerContext(context);
	if (!valid) throw new Error("Refusing to write invalid learner state.");
	await mkdir(learnerDir, { recursive: true });
	await writeFile(
		temporaryStatePath,
		`${JSON.stringify(valid, null, 2)}\n`,
		"utf8",
	);
	await rename(temporaryStatePath, statePath);
}
