import type { ChatMessage } from "./ai";
import type { GenreId } from "./genres";
import type { StoryBackgroundImage } from "./storyBackground";

export interface PreparedOpening extends Partial<StoryBackgroundImage> {
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

export async function listPreparedOpenings(): Promise<
	PreparedOpeningSummary[]
> {
	const response = await fetch("/api/openings");
	return parseResponse<PreparedOpeningSummary[]>(response);
}

export async function prepareMissingOpenings(): Promise<
	PreparedOpeningSummary[]
> {
	const response = await fetch("/api/openings/prepare", { method: "POST" });
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

async function parseResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		throw new Error(await response.text());
	}
	if (response.status === 204) return undefined as T;
	return response.json() as Promise<T>;
}
