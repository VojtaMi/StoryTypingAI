import type { ChatMessage, ReadingStoryFrame, StoryMemory } from "../ai";
import type { StoryPhase, StorySegment } from "../exercise_screen/types";
import type { Genre } from "../genres";
import type { NarrationVoiceId } from "../narrationVoice";
import type { PreparedReadingPart, SavedStory } from "../saves";
import type { StoryOpeningAudio } from "../storyAudio";
import type { StoryBackgroundImage } from "../storyBackground";
import type { StoryRecapLesson } from "../storyRecap";

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
	preparedNextPart?: PreparedReadingPart | null;
	storyRecapLesson?: StoryRecapLesson | null;
}

export function fallbackTitle(selected: Genre) {
	return `${selected.label} Story`;
}

export function createSaveId(title?: string) {
	const id = crypto.randomUUID
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const suffix = id.slice(0, 8).toLowerCase();
	const slug = title ? slugify(title) || "story" : "story";
	return `${slug}--${suffix}`;
}

function slugify(value: string) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
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
	preparedNextPart,
	storyRecapLesson,
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
		preparedNextPart: preparedNextPart ?? undefined,
		storyRecapLesson: storyRecapLesson ?? undefined,
		...(backgroundImage ?? undefined),
		...(openingAudio ?? undefined),
	};
}
