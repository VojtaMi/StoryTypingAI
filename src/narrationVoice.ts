export const NARRATION_VOICES = [
	{ id: "marin" },
	{ id: "cedar" },
	{ id: "fable" },
	{ id: "coral" },
	{ id: "sage" },
	{ id: "onyx" },
] as const;

export type NarrationVoiceId = (typeof NARRATION_VOICES)[number]["id"];
export const DEFAULT_NARRATION_VOICE: NarrationVoiceId = "fable";

export function pickRandomNarrationVoice(): NarrationVoiceId {
	return NARRATION_VOICES[Math.floor(Math.random() * NARRATION_VOICES.length)]
		.id;
}

export function isNarrationVoiceId(value: unknown): value is NarrationVoiceId {
	return (
		typeof value === "string" &&
		NARRATION_VOICES.some((voice) => voice.id === value)
	);
}

export function narrationVoiceOptions(voiceId: NarrationVoiceId) {
	const voice = NARRATION_VOICES.find((candidate) => candidate.id === voiceId);
	return {
		voice: voice?.id ?? DEFAULT_NARRATION_VOICE,
	};
}
