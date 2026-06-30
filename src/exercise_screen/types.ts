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
	| "finished";

export interface TypingStats {
	wpm: number;
	accuracy: number;
}
