import type { ChatMessage, ReadingStory, StoryMemory } from "../ai";
import type { StoryPhase, StorySegment } from "../exercise_screen/types";
import type { Genre } from "../genres";
import type { NarrationVoiceId } from "../narrationVoice";
import type { SavedStory } from "../saves";
import type { StoryOpeningAudio } from "../storyAudio";
import type { StoryBackgroundImage } from "../storyBackground";
import type { StoryRecapExerciseResult, StoryRecapLesson } from "../storyRecap";

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
	readingStory?: ReadingStory;
	readingPartIndex?: number;
	backgroundImage?: StoryBackgroundImage | null;
	openingAudio?: StoryOpeningAudio | null;
	storyRecapLesson?: StoryRecapLesson | null;
	storyRecapResults?: StoryRecapExerciseResult[];
	storyLearnerQuestions?: string[];
	storyFeedback?: string | null;
	storyFeedbackSubmittedAt?: string | null;
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
	readingStory,
	readingPartIndex,
	backgroundImage,
	openingAudio,
	storyRecapLesson,
	storyRecapResults,
	storyLearnerQuestions,
	storyFeedback,
	storyFeedbackSubmittedAt,
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
		readingStory,
		readingPartIndex,
		storyRecapLesson: storyRecapLesson ?? undefined,
		storyRecapResults: storyRecapResults ?? undefined,
		storyLearnerQuestions: storyLearnerQuestions ?? undefined,
		storyFeedback: storyFeedback ?? undefined,
		...(backgroundImage ?? undefined),
		...(openingAudio ?? undefined),
		...(storyFeedbackSubmittedAt ? { storyFeedbackSubmittedAt } : {}),
	};
}
