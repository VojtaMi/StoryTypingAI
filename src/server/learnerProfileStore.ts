import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const learnerDir = join(process.cwd(), "learner");
const profilePath = join(learnerDir, "profile.md");

/**
 * The starting handout. It assumes a complete beginner, so day-one story
 * generation behaves as before; the refine pass improves it over time from what
 * the learner asks the tutor bot.
 */
export const DEFAULT_LEARNER_PROFILE = `---
level: absolute-beginner
updated: never
---

# Confident

Nothing yet — treat this learner as a complete beginner.

# Currently learning (their edge)

The very first Esperanto words and the copula \`estas\`.

# Shaky / watch for

Unknown so far. Introduce new vocabulary slowly and repeat it often.

# About this learner

New to Esperanto. Prefers short, concrete sentences with plenty of repetition.
`;

export async function readLearnerProfile(): Promise<string> {
	try {
		return await readFile(profilePath, "utf8");
	} catch {
		return DEFAULT_LEARNER_PROFILE;
	}
}

export async function writeLearnerProfile(content: string): Promise<void> {
	await mkdir(learnerDir, { recursive: true });
	const normalized = content.endsWith("\n") ? content : `${content}\n`;
	await writeFile(profilePath, normalized, "utf8");
}
