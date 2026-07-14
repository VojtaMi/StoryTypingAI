import type { ChatMessage, ReadingStory, StoryMemory } from "./ai";
import type { StoryPhase, StorySegment } from "./exercise_screen/types";
import type { GenreId } from "./genres";
import type { NarrationVoiceId } from "./narrationVoice";
import type { StoryOpeningAudio } from "./storyAudio";
import type { StoryBackgroundImage } from "./storyBackground";
import type { StoryRecapLesson } from "./storyRecap";

export interface SavedStory
	extends Partial<StoryBackgroundImage>,
		Partial<StoryOpeningAudio> {
	id: string;
	genreId: GenreId;
	title: string;
	updatedAt: string;
	messages: ChatMessage[];
	memory?: StoryMemory;
	segments: StorySegment[];
	currentTarget: string | null;
	phase: StoryPhase;
	backgroundIntro?: string;
	narrationVoice?: NarrationVoiceId;
	/** The whole story a reading save is a cursor into; absent on typing saves. */
	readingStory?: ReadingStory;
	readingPartIndex?: number;
	storyRecapLesson?: StoryRecapLesson | null;
	storyFeedbackSubmittedAt?: string | null;
}

export interface SavedStorySummary {
	id: string;
	genreId: GenreId;
	title: string;
	updatedAt: string;
	preview: string;
}

export async function listSavedStories(): Promise<SavedStorySummary[]> {
	const response = await fetch("/api/saves");
	return parseResponse<SavedStorySummary[]>(response);
}

export async function loadSavedStory(id: string): Promise<SavedStory> {
	const response = await fetch(`/api/saves/${encodeURIComponent(id)}`);
	return parseResponse<SavedStory>(response);
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
