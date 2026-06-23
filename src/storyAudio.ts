import type { NarrationVoiceId } from "./narrationVoice";

export type OpeningAudioSource = "generated";

export interface StoryOpeningAudio {
	openingAudioUrl: string;
	openingAudioSource: OpeningAudioSource;
	openingAudioText?: string;
	openingAudioVoice?: NarrationVoiceId;
}
