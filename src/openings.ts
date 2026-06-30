import type { ChatMessage, ReadingStoryFrame } from "./ai";
import type { GenreId } from "./genres";
import { DEFAULT_TEXT_MODEL, type TextModelId } from "./models";
import type { NarrationVoiceId } from "./narrationVoice";
import type { StoryOpeningAudio } from "./storyAudio";
import type { StoryBackgroundImage } from "./storyBackground";

export interface PreparedOpening
	extends Partial<StoryBackgroundImage>,
		Partial<StoryOpeningAudio> {
	id?: string;
	genreId: GenreId;
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
	text: string;
	messages: ChatMessage[];
	readingFrame: ReadingStoryFrame;
	readingPartIndex: number;
	narrationVoice: NarrationVoiceId;
	createdAt: string;
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
	model: TextModelId = DEFAULT_TEXT_MODEL,
): Promise<PreparedReadingOpeningSummary[]> {
	const response = await fetch("/api/reading-openings/prepare", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ model }),
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
