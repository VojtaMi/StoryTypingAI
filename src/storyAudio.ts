export type OpeningAudioSource = "generated";

export interface StoryOpeningAudio {
	openingAudioUrl: string;
	openingAudioSource: OpeningAudioSource;
	openingAudioText?: string;
}
