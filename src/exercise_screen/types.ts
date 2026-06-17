export interface StorySegment {
	id: number;
	author: "ai" | "user";
	text: string;
}

export type StoryPhase = "typing" | "authoring" | "loading";

export interface TypingStats {
	wpm: number;
	accuracy: number;
}
