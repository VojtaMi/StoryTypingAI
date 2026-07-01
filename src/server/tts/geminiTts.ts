import { GEMINI_TTS_MODEL } from "./constants";
import type { ProviderTtsRequest, SynthesizedSpeech } from "./types";
import { geminiVoice } from "./voices";
import { pcmToWav } from "./wav";

type GeminiGenerateContentResponse = {
	candidates?: Array<{
		content?: {
			parts?: Array<{
				inlineData?: {
					data?: string;
					mimeType?: string;
				};
			}>;
		};
	}>;
};

export async function synthesizeGeminiSpeech({
	input,
	instructions,
	voice,
}: ProviderTtsRequest): Promise<SynthesizedSpeech> {
	const apiKey = process.env.GEMINI_API_KEY ?? "";
	if (!apiKey) throw new Error("Gemini API key is not configured.");

	const selectedVoice = geminiVoice(voice);
	const prompt = [
		"Synthesize speech for an Esperanto learning app.",
		instructions,
		"Read only the transcript. Keep Esperanto pronunciation careful, natural, and learner-friendly.",
		"",
		"Transcript:",
		input,
	]
		.filter(Boolean)
		.join("\n");
	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-goog-api-key": apiKey,
			},
			body: JSON.stringify({
				contents: [{ parts: [{ text: prompt }] }],
				generationConfig: {
					responseModalities: ["AUDIO"],
					speechConfig: {
						voiceConfig: {
							prebuiltVoiceConfig: { voiceName: selectedVoice },
						},
					},
				},
			}),
		},
	);

	if (!response.ok) {
		throw new Error(
			`Gemini TTS request failed: ${response.status} ${response.statusText}`,
		);
	}

	const json = (await response.json()) as GeminiGenerateContentResponse;
	const inlineData = json.candidates?.[0]?.content?.parts?.find(
		(part) => part.inlineData,
	)?.inlineData;
	if (!inlineData?.data) {
		throw new Error("Gemini TTS response did not include audio data.");
	}

	return {
		audio: pcmToWav(Buffer.from(inlineData.data, "base64")),
		extension: "wav",
		mimeType: "audio/wav",
		model: GEMINI_TTS_MODEL,
		provider: "gemini",
		voice: selectedVoice,
	};
}
