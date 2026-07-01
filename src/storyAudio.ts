import type { NarrationVoiceId } from "./narrationVoice";

export type OpeningAudioSource = "generated";

export interface StoryOpeningAudio {
	openingAudioUrl: string;
	openingAudioSource: OpeningAudioSource;
	openingAudioText?: string;
	openingAudioTextHash?: string;
	openingAudioVoice?: NarrationVoiceId;
	openingAudioProvider?: string;
	openingAudioModel?: string;
	openingAudioMimeType?: string;
}

export function isStoryOpeningAudioForText(
	audio: StoryOpeningAudio | null | undefined,
	text: string,
	voice?: NarrationVoiceId,
) {
	return (
		audio?.openingAudioText === text &&
		(!voice || !audio.openingAudioVoice || audio.openingAudioVoice === voice)
	);
}
