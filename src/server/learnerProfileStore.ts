import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LearnerContext } from "../learnerContext";

const learnerDir = join(process.cwd(), "learner");
const profilePath = join(learnerDir, "profile.md");
const preferencesPath = join(learnerDir, "preferences.md");
const storyMemoryPath = join(learnerDir, "story-memory.md");

/**
 * The starting handout. It assumes a complete beginner, so day-one story
 * generation behaves as before; the refine pass improves it over time from what
 * the learner asks the tutor bot.
 */
export const DEFAULT_LEARNER_PROFILE = `---
type: learner-language-profile
title: Esperanto learner language profile
tags: [esperanto, learner, language]
level: absolute-beginner
updated: never
---

# Confident

Nothing yet — treat this learner as a complete beginner.

# Currently learning (their edge)

The very first Esperanto words and the copula \`estas\`.

# Shaky / watch for

Unknown so far. Introduce new vocabulary slowly and repeat it often.

# Recently practiced

Nothing yet — no stories finished so far.

# About this learner

New to Esperanto. Prefers short, concrete sentences with plenty of repetition.
`;

export const DEFAULT_LEARNER_PREFERENCES = `---
type: learner-preferences
title: Esperanto story and lesson preferences
tags: [esperanto, learner, preferences, stories]
updated: never
---

# Desired feel

Use beginner Esperanto, but choose adult-respectful premises by default.

# Prefer

Everyday adult or age-neutral situations, quiet mystery, travel, errands, cafes, apartments, libraries, markets, transit, work-adjacent settings, and practical small decisions.

# Avoid

Child protagonists by default unless specifically requested.

Lost-and-found object plots.

Animal rescue plots.

Helpful adult or neighbor solves the problem for the main character.

Overly kindergarten emotional stakes.
`;

export const DEFAULT_STORY_MEMORY = `---
type: story-memory
title: Recent Esperanto story motifs
tags: [esperanto, story-generation, anti-repetition]
updated: never
---

# Recently used motifs

Nothing yet.

# Recently used objects and settings

Nothing yet.

# Avoid next

Avoid defaulting to a child protagonist, lost object, animal in need, park bench, garden, worried neighbor, or simple rescue/return plot unless the learner explicitly asks for one.
`;

export async function readLearnerProfile(): Promise<string> {
	return readLearnerFile(profilePath, DEFAULT_LEARNER_PROFILE);
}

export async function readLearnerPreferences(): Promise<string> {
	return readLearnerFile(preferencesPath, DEFAULT_LEARNER_PREFERENCES);
}

export async function readStoryMemory(): Promise<string> {
	return readLearnerFile(storyMemoryPath, DEFAULT_STORY_MEMORY);
}

export async function readLearnerContext(): Promise<LearnerContext> {
	const [languageProfile, preferences, storyMemory] = await Promise.all([
		readLearnerProfile(),
		readLearnerPreferences(),
		readStoryMemory(),
	]);
	return { languageProfile, preferences, storyMemory };
}

export async function writeLearnerProfile(content: string): Promise<void> {
	return writeLearnerFile(profilePath, content);
}

export async function writeLearnerPreferences(content: string): Promise<void> {
	return writeLearnerFile(preferencesPath, content);
}

export async function writeStoryMemory(content: string): Promise<void> {
	return writeLearnerFile(storyMemoryPath, content);
}

async function readLearnerFile(
	path: string,
	defaultContent: string,
): Promise<string> {
	try {
		return await readFile(path, "utf8");
	} catch {
		return defaultContent;
	}
}

async function writeLearnerFile(path: string, content: string): Promise<void> {
	await mkdir(learnerDir, { recursive: true });
	const normalized = content.endsWith("\n") ? content : `${content}\n`;
	await writeFile(path, normalized, "utf8");
}
