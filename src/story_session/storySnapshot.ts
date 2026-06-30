import type { ChatMessage, ReadingStoryFrame, StoryMemory } from "../ai";
import type { StoryPhase, StorySegment } from "../exercise_screen/types";
import type { Genre } from "../genres";
import type { NarrationVoiceId } from "../narrationVoice";
import type { SavedStory } from "../saves";
import type { StoryOpeningAudio } from "../storyAudio";
import type { StoryBackgroundImage } from "../storyBackground";

interface StorySaveSnapshotInput {
	id: string;
	genre: Genre;
	title: string;
	messages: ChatMessage[];
	memory?: StoryMemory;
	segments: StorySegment[];
	currentTarget: string | null;
	phase: StoryPhase;
	backgroundIntro?: string;
	narrationVoice?: NarrationVoiceId;
	readingFrame?: ReadingStoryFrame;
	readingPartIndex?: number;
	backgroundImage?: StoryBackgroundImage | null;
	openingAudio?: StoryOpeningAudio | null;
}

export function fallbackTitle(selected: Genre) {
	return `${selected.label} Story`;
}

export function createSaveId() {
	if (crypto.randomUUID) return crypto.randomUUID();
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function buildStorySaveSnapshot({
	id,
	genre,
	title,
	messages,
	memory,
	segments,
	currentTarget,
	phase,
	backgroundIntro,
	narrationVoice,
	readingFrame,
	readingPartIndex,
	backgroundImage,
	openingAudio,
}: StorySaveSnapshotInput): Omit<SavedStory, "updatedAt"> {
	return {
		id,
		genreId: genre.id,
		title,
		messages,
		memory,
		segments,
		currentTarget,
		phase,
		backgroundIntro,
		narrationVoice,
		readingFrame,
		readingPartIndex,
		...(backgroundImage ?? undefined),
		...(openingAudio ?? undefined),
	};
}
