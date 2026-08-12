export const LEARNER_STATE_VERSION = 1 as const;

export interface LearnerLanguageProfile {
	version: typeof LEARNER_STATE_VERSION;
	updated: string;
	confident: string[];
	learning: string[];
	shaky: string[];
	recentlyPracticed: string[];
	notes: string[];
}

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
	motif: string;
	protagonist: string;
	setting: string;
	elements: string[];
}

export interface LearnerContext {
	languageProfile: LearnerLanguageProfile;
	preferences: LearnerPreferences;
	storyMemory: StoryMemory;
}

export const DEFAULT_LEARNER_PROFILE: LearnerLanguageProfile = {
	version: LEARNER_STATE_VERSION,
	updated: "never",
	confident: [],
	learning: ["The first Spanish words and the verbs `ser` and `estar`."],
	shaky: ["New vocabulary needs gradual introduction and meaningful reuse."],
	recentlyPracticed: [],
	notes: ["New to Spanish; use short, concrete sentences with clear context."],
};

export const DEFAULT_LEARNER_PREFERENCES: LearnerPreferences = {
	version: LEARNER_STATE_VERSION,
	updated: "never",
	// Beginner-level language reads to the model as a cue to write for children.
	// Editable in Settings like any other preference.
	prefer: ["age target: neutral"],
	avoid: [],
	clarityGuidance: [],
};

export const DEFAULT_STORY_MEMORY: StoryMemory = {
	version: LEARNER_STATE_VERSION,
	updated: "never",
	recentStories: [],
};

export const DEFAULT_LEARNER_CONTEXT: LearnerContext = {
	languageProfile: DEFAULT_LEARNER_PROFILE,
	preferences: DEFAULT_LEARNER_PREFERENCES,
	storyMemory: DEFAULT_STORY_MEMORY,
};

const PROFILE_KEYS = [
	"version",
	"updated",
	"confident",
	"learning",
	"shaky",
	"recentlyPracticed",
	"notes",
] as const;
const PREFERENCES_KEYS = [
	"version",
	"updated",
	"prefer",
	"avoid",
	"clarityGuidance",
] as const;
const MEMORY_KEYS = ["version", "updated", "recentStories"] as const;
const CONTEXT_KEYS = ["languageProfile", "preferences", "storyMemory"] as const;

const LIMITS = {
	confident: 10,
	learning: 8,
	shaky: 8,
	recentlyPracticed: 6,
	notes: 4,
	prefer: 8,
	avoid: 8,
	clarityGuidance: 4,
	recentStories: 5,
	storyElements: 6,
} as const;
const MAX_ITEM_LENGTH = 180;

export function parseLearnerLanguageProfile(
	value: unknown,
): LearnerLanguageProfile | null {
	const object = exactObject(value, PROFILE_KEYS);
	if (!object || !validBase(object)) {
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
		object.recentStories.length > LIMITS.recentStories
	) {
		return null;
	}
	const recentStories: RecentStoryMemory[] = [];
	for (const value of object.recentStories) {
		const story = exactObject(value, [
			"motif",
			"protagonist",
			"setting",
			"elements",
		]);
		if (!story) return null;
		const motif = boundedString(story.motif);
		const protagonist = boundedString(story.protagonist);
		const setting = boundedString(story.setting);
		const elements = boundedStrings(story.elements, LIMITS.storyElements);
		if (!motif || !protagonist || !setting || !elements) return null;
		recentStories.push({ motif, protagonist, setting, elements });
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
		.slice(0, LIMITS.recentStories);
	return {
		version: LEARNER_STATE_VERSION,
		updated: today,
		recentStories,
	};
}

function storyKey(story: RecentStoryMemory): string {
	return [story.motif, story.protagonist, story.setting]
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
