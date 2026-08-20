import type { ChatMessage, ReadingStory } from "./ai";
import type { StoryPhase, StorySegment } from "./exercise_screen/types";
import type { LanguageId } from "./languages";
import type { NarrationVoiceId } from "./narrationVoice";
import type { StoryOpeningAudio } from "./storyAudio";
import type { StoryBackgroundImage } from "./storyBackground";
import type { StoryRecapExerciseResult, StoryRecapLesson } from "./storyRecap";

export interface SavedStory
	extends Partial<StoryBackgroundImage>,
		Partial<StoryOpeningAudio> {
	id: string;
	genreId: LanguageId;
	title: string;
	updatedAt: string;
	messages: ChatMessage[];
	segments: StorySegment[];
	currentTarget: string | null;
	phase: StoryPhase;
	backgroundIntro?: string;
	narrationVoice?: NarrationVoiceId;
	/** The whole story this save is a cursor into. */
	readingStory?: ReadingStory;
	/** Contextual glosses for the story's words. */
	wordTranslations?: Record<string, string>;
	readingPartIndex?: number;
	storyRecapLesson?: StoryRecapLesson | null;
	storyRecapResults?: StoryRecapExerciseResult[];
	storyLearnerQuestions?: string[];
	storyFeedback?: string | null;
	storyFeedbackSubmittedAt?: string | null;
}

export interface SavedStorySummary {
	id: string;
	genreId: LanguageId;
	title: string;
	updatedAt: string;
	preview: string;
	phase: StoryPhase;
	/** Whether this save is a reading story (has a whole story to cursor into). */
	isReadingStory: boolean;
}

export async function listSavedStories(
	genreId?: LanguageId,
): Promise<SavedStorySummary[]> {
	const query = genreId ? `?language=${encodeURIComponent(genreId)}` : "";
	const response = await fetch(`/api/saves${query}`);
	return parseResponse<SavedStorySummary[]>(response);
}

/**
 * The one reading-story save, if any, that hasn't reached "finished" yet. At
 * most one can exist at a time: a reading story is only ever started by
 * consuming the prepared queue, and the queue only refills once the previous
 * story is finished and finalized.
 */
export function findUnfinishedReadingSave(
	saves: SavedStorySummary[],
): SavedStorySummary | null {
	return (
		saves.find((save) => save.isReadingStory && save.phase !== "finished") ??
		null
	);
}

export async function loadSavedStory(id: string): Promise<SavedStory> {
	const response = await fetch(`/api/saves/${encodeURIComponent(id)}`);
	return parseResponse<SavedStory>(response);
}

/**
 * Fold a section's narration or image into the stored save, leaving every other
 * field as it was found.
 *
 * Media arrives whenever it finishes — which, for media prepared with the story,
 * can be the same tick the story starts. Authoring a whole save from session
 * state at that moment snapshots values that have not settled yet, and the write
 * lands on top of the real one: that is how a live reading story was overwritten
 * with an empty `phase: "loading"` save it could never resume from. What arrived
 * is the only thing this knows to be true, so it is the only thing it writes.
 */
export async function saveStoryMedia(
	id: string,
	media: Partial<StoryBackgroundImage> & Partial<StoryOpeningAudio>,
): Promise<SavedStory> {
	const stored = await loadSavedStory(id);
	return saveStory({
		...stored,
		...media,
		updatedAt: new Date().toISOString(),
	});
}

export async function saveStory(story: SavedStory): Promise<SavedStory> {
	const response = await fetch(`/api/saves/${encodeURIComponent(story.id)}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(story),
	});
	return parseResponse<SavedStory>(response);
}

export async function deleteSavedStory(id: string): Promise<void> {
	const response = await fetch(`/api/saves/${encodeURIComponent(id)}`, {
		method: "DELETE",
	});
	if (!response.ok) {
		throw new Error(await response.text());
	}
}

async function parseResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		throw new Error(await response.text());
	}
	return response.json() as Promise<T>;
}
