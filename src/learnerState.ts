import { type GenreId, isGenreId } from "./genres";

export const LEARNER_STATE_VERSION = 1 as const;

export interface LearnerPreferences {
	version: typeof LEARNER_STATE_VERSION;
	updated: string;
	prefer: string[];
	avoid: string[];
	clarityGuidance: string[];
}

export interface StoryMemory {
	version: typeof LEARNER_STATE_VERSION;
	updated: string;
	recentStories: RecentStoryMemory[];
}

export interface RecentStoryMemory {
	genreId: GenreId;
	motif: string;
	protagonist: string;
	setting: string;
	elements: string[];
}

export interface LearnerContext {
	preferences: LearnerPreferences;
	storyMemory: StoryMemory;
}

export const DEFAULT_LEARNER_PREFERENCES: LearnerPreferences = {
	version: LEARNER_STATE_VERSION,
	updated: "never",
	prefer: [],
	avoid: [],
	clarityGuidance: [],
};

export const DEFAULT_STORY_MEMORY: StoryMemory = {
	version: LEARNER_STATE_VERSION,
	updated: "never",
	recentStories: [],
};

export const DEFAULT_LEARNER_CONTEXT: LearnerContext = {
	preferences: DEFAULT_LEARNER_PREFERENCES,
	storyMemory: DEFAULT_STORY_MEMORY,
};
const PREFERENCES_KEYS = [
	"version",
	"updated",
	"prefer",
	"avoid",
	"clarityGuidance",
] as const;
const MEMORY_KEYS = ["version", "updated", "recentStories"] as const;
const CONTEXT_KEYS = ["preferences", "storyMemory"] as const;

const LIMITS = {
	prefer: 8,
	avoid: 8,
	clarityGuidance: 4,
	recentStories: 5,
	storyElements: 6,
} as const;
const MAX_ITEM_LENGTH = 180;

export function parseLearnerPreferences(
	value: unknown,
): LearnerPreferences | null {
	const object = exactObject(value, PREFERENCES_KEYS);
	if (!object || !validBase(object)) return null;
	const prefer = boundedStrings(object.prefer, LIMITS.prefer);
	const avoid = boundedStrings(object.avoid, LIMITS.avoid);
	const clarityGuidance = boundedStrings(
		object.clarityGuidance,
		LIMITS.clarityGuidance,
	);
	if (!prefer || !avoid || !clarityGuidance) return null;
	return {
		version: LEARNER_STATE_VERSION,
		updated: object.updated as string,
		prefer,
		avoid,
		clarityGuidance,
	};
}

export function parseStoryMemory(value: unknown): StoryMemory | null {
	const object = exactObject(value, MEMORY_KEYS);
	if (!object || !validBase(object)) return null;
	if (
		!Array.isArray(object.recentStories) ||
		object.recentStories.length > LIMITS.recentStories * 3
	) {
		return null;
	}
	const recentStories: RecentStoryMemory[] = [];
	for (const value of object.recentStories) {
		const story = exactObject(value, [
			"genreId",
			"motif",
			"protagonist",
			"setting",
			"elements",
		]);
		if (!story || !isGenreId(story.genreId)) return null;
		const motif = boundedString(story.motif);
		const protagonist = boundedString(story.protagonist);
		const setting = boundedString(story.setting);
		const elements = boundedStrings(story.elements, LIMITS.storyElements);
		if (!motif || !protagonist || !setting || !elements) return null;
		recentStories.push({
			genreId: story.genreId,
			motif,
			protagonist,
			setting,
			elements,
		});
	}
	return {
		version: LEARNER_STATE_VERSION,
		updated: object.updated as string,
		recentStories,
	};
}

export function parseLearnerContext(value: unknown): LearnerContext | null {
	const object = exactObject(value, CONTEXT_KEYS);
	if (!object) return null;
	const preferences = parseLearnerPreferences(object.preferences);
	const storyMemory = parseStoryMemory(object.storyMemory);
	if (!preferences || !storyMemory) return null;
	return { preferences, storyMemory };
}

export function parseJsonResponse(text: string): unknown {
	const fenced = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1];
	return JSON.parse(fenced ?? text);
}

export function mergeStoryMemory(
	current: StoryMemory,
	newStory: RecentStoryMemory,
	today: string,
): StoryMemory {
	const recentStories = [newStory, ...current.recentStories]
		.filter((story, index, stories) => {
			const key = storyKey(story);
			return (
				stories.findIndex((candidate) => storyKey(candidate) === key) === index
			);
		})
		.filter((story, index, stories) => {
			const languageIndex = stories
				.slice(0, index + 1)
				.filter((candidate) => candidate.genreId === story.genreId).length;
			return languageIndex <= LIMITS.recentStories;
		});
	return {
		version: LEARNER_STATE_VERSION,
		updated: today,
		recentStories,
	};
}

function storyKey(story: RecentStoryMemory): string {
	return [story.genreId, story.motif, story.protagonist, story.setting]
		.join("|")
		.toLocaleLowerCase();
}

function validBase(object: Record<string, unknown>): boolean {
	return (
		object.version === LEARNER_STATE_VERSION &&
		typeof object.updated === "string" &&
		(object.updated === "never" || /^\d{4}-\d{2}-\d{2}$/.test(object.updated))
	);
}

function exactObject(
	value: unknown,
	keys: readonly string[],
): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const object = value as Record<string, unknown>;
	const actualKeys = Object.keys(object).sort();
	const expectedKeys = [...keys].sort();
	if (
		actualKeys.length !== expectedKeys.length ||
		actualKeys.some((key, index) => key !== expectedKeys[index])
	) {
		return null;
	}
	return object;
}

function boundedStrings(value: unknown, maxItems: number): string[] | null {
	if (!Array.isArray(value) || value.length > maxItems) return null;
	const strings: string[] = [];
	for (const item of value) {
		if (typeof item !== "string") return null;
		const trimmed = item.trim();
		if (!trimmed || trimmed.length > MAX_ITEM_LENGTH) return null;
		if (!strings.includes(trimmed)) strings.push(trimmed);
	}
	return strings;
}

function boundedString(value: unknown): string | null {
	return typeof value === "string" &&
		value.trim() &&
		value.trim().length <= MAX_ITEM_LENGTH
		? value.trim()
		: null;
}
