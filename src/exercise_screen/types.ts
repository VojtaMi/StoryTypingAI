import type { StoryOpeningAudio } from "../storyAudio";

export interface StorySegment {
	id: number;
	author: "ai" | "user";
	text: string;
	narrationAudio?: StoryOpeningAudio | null;
}

export type StoryPhase =
	| "typing"
	| "authoring"
	| "loading"
	| "reading"
	| "recap-loading"
	| "recap"
	| "finished";

export interface TypingStats {
	wpm: number;
	accuracy: number;
}
