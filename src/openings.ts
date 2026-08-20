import type { ChatMessage, ReadingStory } from "./ai";
import type { LanguageId } from "./languages";
import {
	DEFAULT_STORY_GENERATION_PRESET_ID,
	getStoryGenerationPreset,
	type StoryGenerationPreset,
} from "./models";
import type { NarrationVoiceId } from "./narrationVoice";
import type { StoryOpeningAudio } from "./storyAudio";
import type { StoryBackgroundImage } from "./storyBackground";
import { DEFAULT_TTS_MODEL, type TtsModelId } from "./ttsModel";

export interface PreparedReadingOpening
	extends Partial<StoryBackgroundImage>,
		Partial<StoryOpeningAudio> {
	id: string;
	genreId: LanguageId;
	title?: string;
	text: string;
	messages: ChatMessage[];
	/** The complete story; `text` and the media fields above are its part 1. */
	readingStory: ReadingStory;
	/**
	 * Contextual English glosses for every story word, generated once at prepare
	 * time against the full story. The hover glossary and recap read from this
	 * map; there is no global word cache.
	 */
	wordTranslations: Record<string, string>;
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
	genreId: LanguageId;
	createdAt: string;
}

export async function listPreparedReadingOpenings(
	genreId: LanguageId,
): Promise<PreparedReadingOpeningSummary[]> {
	const response = await fetch(
		`/api/reading-openings?language=${encodeURIComponent(genreId)}`,
	);
	return parseResponse<PreparedReadingOpeningSummary[]>(response);
}

export async function prepareMissingReadingOpenings(
	genreId: LanguageId,
	storyGeneration: StoryGenerationPreset = getStoryGenerationPreset(
		DEFAULT_STORY_GENERATION_PRESET_ID,
	),
	basedOnStoryId: string | null = null,
	nextTheme?: string,
	ttsModel: TtsModelId = DEFAULT_TTS_MODEL,
): Promise<PreparedReadingOpeningSummary[]> {
	const response = await fetch("/api/reading-openings/prepare", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			genreId,
			model: storyGeneration.model,
			reasoningEffort: storyGeneration.reasoningEffort,
			basedOnStoryId,
			nextTheme,
			ttsModel,
		}),
	});
	return parseResponse<PreparedReadingOpeningSummary[]>(response);
}

export async function consumePreparedReadingOpening(
	genreId: LanguageId,
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
