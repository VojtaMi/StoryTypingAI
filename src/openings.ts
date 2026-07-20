import type { ChatMessage, ReadingStory } from "./ai";
import type { GenreId } from "./genres";
import {
	DEFAULT_STORY_GENERATION_PRESET_ID,
	DEFAULT_TEXT_MODEL,
	getStoryGenerationPreset,
	type StoryGenerationPreset,
	type TextModelId,
} from "./models";
import type { NarrationVoiceId } from "./narrationVoice";
import type { StoryOpeningAudio } from "./storyAudio";
import type { StoryBackgroundImage } from "./storyBackground";

export interface PreparedOpening
	extends Partial<StoryBackgroundImage>,
		Partial<StoryOpeningAudio> {
	id?: string;
	genreId: GenreId;
	title?: string;
	text: string;
	backgroundIntro?: string;
	messages: ChatMessage[];
	createdAt: string;
}

export interface PreparedOpeningSummary {
	genreId: GenreId;
	createdAt: string;
}

export interface PreparedReadingOpening
	extends Partial<StoryBackgroundImage>,
		Partial<StoryOpeningAudio> {
	id: string;
	genreId: GenreId;
	title?: string;
	text: string;
	messages: ChatMessage[];
	/** The complete story; `text` and the media fields above are its part 1. */
	readingStory: ReadingStory;
	readingPartIndex: number;
	narrationVoice: NarrationVoiceId;
	createdAt: string;
	/**
	 * The finished story this was prepared after finalizing, or `null` for the
	 * very first story. A queued entry whose value doesn't match the
	 * finalization that just ran is stale and must be discarded rather than
	 * accepted, since it was generated against state that finalization replaced.
	 */
	basedOnStoryId: string | null;
}

export interface PreparedReadingOpeningSummary {
	genreId: GenreId;
	createdAt: string;
}

export async function listPreparedOpenings(): Promise<
	PreparedOpeningSummary[]
> {
	const response = await fetch("/api/openings");
	return parseResponse<PreparedOpeningSummary[]>(response);
}

export async function prepareMissingOpenings(
	model: TextModelId = DEFAULT_TEXT_MODEL,
): Promise<PreparedOpeningSummary[]> {
	const response = await fetch("/api/openings/prepare", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ model }),
	});
	return parseResponse<PreparedOpeningSummary[]>(response);
}

export async function consumePreparedOpening(
	genreId: GenreId,
): Promise<PreparedOpening | null> {
	const response = await fetch(
		`/api/openings/${encodeURIComponent(genreId)}/consume`,
		{ method: "POST" },
	);
	return parseResponse<PreparedOpening | null>(response);
}

export async function listPreparedReadingOpenings(): Promise<
	PreparedReadingOpeningSummary[]
> {
	const response = await fetch("/api/reading-openings");
	return parseResponse<PreparedReadingOpeningSummary[]>(response);
}

export async function prepareMissingReadingOpenings(
	storyGeneration: StoryGenerationPreset = getStoryGenerationPreset(
		DEFAULT_STORY_GENERATION_PRESET_ID,
	),
	basedOnStoryId: string | null = null,
	nextTheme?: string,
): Promise<PreparedReadingOpeningSummary[]> {
	const response = await fetch("/api/reading-openings/prepare", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			model: storyGeneration.model,
			reasoningEffort: storyGeneration.reasoningEffort,
			basedOnStoryId,
			nextTheme,
		}),
	});
	return parseResponse<PreparedReadingOpeningSummary[]>(response);
}

export async function consumePreparedReadingOpening(
	genreId: GenreId,
): Promise<PreparedReadingOpening | null> {
	const response = await fetch(
		`/api/reading-openings/${encodeURIComponent(genreId)}/consume`,
		{ method: "POST" },
	);
	return parseResponse<PreparedReadingOpening | null>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		throw new Error(await response.text());
	}
	if (response.status === 204) return undefined as T;
	return response.json() as Promise<T>;
}
