import { OPENAI_TTS_MODEL, OPENAI_TTS_VOICE } from "./constants";
import type { ProviderTtsRequest, SynthesizedSpeech } from "./types";

export async function synthesizeOpenAiSpeech({
	openai,
	input,
	instructions,
	speed,
	voice,
}: ProviderTtsRequest): Promise<SynthesizedSpeech> {
	const response = await openai.audio.speech.create({
		model: OPENAI_TTS_MODEL,
		voice: voice ?? OPENAI_TTS_VOICE,
		input,
		...(instructions ? { instructions } : {}),
		response_format: "mp3",
		...(speed ? { speed } : {}),
	});
	return {
		audio: Buffer.from(await response.arrayBuffer()),
		extension: "mp3",
		mimeType: "audio/mpeg",
		model: OPENAI_TTS_MODEL,
		provider: "openai",
		voice: voice ?? OPENAI_TTS_VOICE,
	};
}
