export const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
export const OPENAI_TTS_VOICE = "fable";

export const GEMINI_TTS_MODELS = [
	"gemini-2.5-flash-preview-tts",
	"gemini-3.1-flash-tts-preview",
] as const;
export type GeminiTtsModel = (typeof GEMINI_TTS_MODELS)[number];

/** Cheaper of the two Gemini TTS models; switch a request to the newer one via `geminiModel`. */
export const DEFAULT_GEMINI_TTS_MODEL: GeminiTtsModel =
	"gemini-3.1-flash-tts-preview";

/**
 * Hard character ceiling for a single speech request. The OpenAI speech endpoint
 * rejects input longer than 4096 characters; story segments are far shorter, so
 * this is a safety net rather than a length we expect to hit.
 */
export const TTS_MAX_INPUT_CHARS = 4096;
