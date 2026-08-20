import type { StoryOpeningAudio } from "../storyAudio";

export interface StorySegment {
	id: number;
	author: "ai" | "user";
	text: string;
	narrationAudio?: StoryOpeningAudio | null;
}

export type StoryPhase =
	| "loading"
	| "error"
	| "reading"
	| "recap-loading"
	| "recap"
	| "finished";
