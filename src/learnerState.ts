export const LEARNER_STATE_VERSION = 1 as const;

export const LEARNER_LEVELS = [
	"absolute-beginner",
	"beginner",
	"elementary",
	"intermediate",
] as const;

export type LearnerLevel = (typeof LEARNER_LEVELS)[number];

export interface LearnerLanguageProfile {
	version: typeof LEARNER_STATE_VERSION;
	updated: string;
	level: LearnerLevel;
	confident: string[];
	learning: string[];
	shaky: string[];
	recentlyPracticed: string[];
	notes: string[];
}

export interface LearnerPreferences {
	version: typeof LEARNER_STATE_VERSION;
	updated: string;
	desiredFeel: string[];
	prefer: string[];
	avoid: string[];
	clarityGuidance: string[];
}

export interface StoryMemory {
	version: typeof LEARNER_STATE_VERSION;
	updated: string;
	recentMotifs: string[];
	recentElements: string[];
	avoidNext: string[];
}

export interface LearnerContext {
	languageProfile: LearnerLanguageProfile;
	preferences: LearnerPreferences;
	storyMemory: StoryMemory;
}

export const DEFAULT_LEARNER_PROFILE: LearnerLanguageProfile = {
	version: LEARNER_STATE_VERSION,
	updated: "never",
	level: "absolute-beginner",
	confident: [],
	learning: ["The first Esperanto words and the copula `estas`."],
	shaky: ["New vocabulary needs gradual introduction and meaningful reuse."],
	recentlyPracticed: [],
	notes: [
		"New to Esperanto; use short, concrete sentences with clear context.",
	],
};

export const DEFAULT_LEARNER_PREFERENCES: LearnerPreferences = {
	version: LEARNER_STATE_VERSION,
	updated: "never",
	desiredFeel: [
		"Beginner Esperanto in adult-respectful, age-appropriate stories.",
	],
	prefer: [],
	avoid: [],
	clarityGuidance: [],
};

export const DEFAULT_STORY_MEMORY: StoryMemory = {
	version: LEARNER_STATE_VERSION,
	updated: "never",
	recentMotifs: [],
	recentElements: [],
	avoidNext: [],
};

export const DEFAULT_LEARNER_CONTEXT: LearnerContext = {
	languageProfile: DEFAULT_LEARNER_PROFILE,
	preferences: DEFAULT_LEARNER_PREFERENCES,
	storyMemory: DEFAULT_STORY_MEMORY,
};

const PROFILE_KEYS = [
	"version",
	"updated",
	"level",
	"confident",
	"learning",
	"shaky",
	"recentlyPracticed",
	"notes",
] as const;
const PREFERENCES_KEYS = [
	"version",
	"updated",
	"desiredFeel",
	"prefer",
	"avoid",
	"clarityGuidance",
] as const;
const MEMORY_KEYS = [
	"version",
	"updated",
	"recentMotifs",
	"recentElements",
	"avoidNext",
] as const;
const CONTEXT_KEYS = ["languageProfile", "preferences", "storyMemory"] as const;

const LIMITS = {
	confident: 10,
	learning: 8,
	shaky: 8,
	recentlyPracticed: 6,
	notes: 4,
	desiredFeel: 4,
	prefer: 8,
	avoid: 8,
	clarityGuidance: 4,
	recentMotifs: 8,
	recentElements: 8,
	avoidNext: 6,
} as const;
const MAX_ITEM_LENGTH = 180;

export function parseLearnerLanguageProfile(
	value: unknown,
): LearnerLanguageProfile | null {
	const object = exactObject(value, PROFILE_KEYS);
	if (
		!object ||
		!validBase(object) ||
		!LEARNER_LEVELS.includes(object.level as LearnerLevel)
	) {
		return null;
	}
	const confident = boundedStrings(object.confident, LIMITS.confident);
	const learning = boundedStrings(object.learning, LIMITS.learning);
	const shaky = boundedStrings(object.shaky, LIMITS.shaky);
	const recentlyPracticed = boundedStrings(
		object.recentlyPracticed,
		LIMITS.recentlyPracticed,
	);
	const notes = boundedStrings(object.notes, LIMITS.notes);
	if (!confident || !learning || !shaky || !recentlyPracticed || !notes) {
		return null;
	}
	return {
		version: LEARNER_STATE_VERSION,
		updated: object.updated as string,
		level: object.level as LearnerLevel,
		confident,
		learning,
		shaky,
		recentlyPracticed,
		notes,
	};
}

export function parseLearnerPreferences(
	value: unknown,
): LearnerPreferences | null {
	const object = exactObject(value, PREFERENCES_KEYS);
	if (!object || !validBase(object)) return null;
	const desiredFeel = boundedStrings(object.desiredFeel, LIMITS.desiredFeel);
	const prefer = boundedStrings(object.prefer, LIMITS.prefer);
	const avoid = boundedStrings(object.avoid, LIMITS.avoid);
	const clarityGuidance = boundedStrings(
		object.clarityGuidance,
		LIMITS.clarityGuidance,
	);
	if (!desiredFeel || !prefer || !avoid || !clarityGuidance) return null;
	return {
		version: LEARNER_STATE_VERSION,
		updated: object.updated as string,
		desiredFeel,
		prefer,
		avoid,
		clarityGuidance,
	};
}

export function parseStoryMemory(value: unknown): StoryMemory | null {
	const object = exactObject(value, MEMORY_KEYS);
	if (!object || !validBase(object)) return null;
	const recentMotifs = boundedStrings(object.recentMotifs, LIMITS.recentMotifs);
	const recentElements = boundedStrings(
		object.recentElements,
		LIMITS.recentElements,
	);
	const avoidNext = boundedStrings(object.avoidNext, LIMITS.avoidNext);
	if (!recentMotifs || !recentElements || !avoidNext) return null;
	return {
		version: LEARNER_STATE_VERSION,
		updated: object.updated as string,
		recentMotifs,
		recentElements,
		avoidNext,
	};
}

export function parseLearnerContext(value: unknown): LearnerContext | null {
	const object = exactObject(value, CONTEXT_KEYS);
	if (!object) return null;
	const languageProfile = parseLearnerLanguageProfile(object.languageProfile);
	const preferences = parseLearnerPreferences(object.preferences);
	const storyMemory = parseStoryMemory(object.storyMemory);
	if (!languageProfile || !preferences || !storyMemory) return null;
	return { languageProfile, preferences, storyMemory };
}

export function parseJsonResponse(text: string): unknown {
	const fenced = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1];
	return JSON.parse(fenced ?? text);
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
