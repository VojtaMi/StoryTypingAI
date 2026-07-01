export const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
export const OPENAI_TTS_VOICE = "fable";
export const GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";

/**
 * Hard character ceiling for a single speech request. The OpenAI speech endpoint
 * rejects input longer than 4096 characters; story segments are far shorter, so
 * this is a safety net rather than a length we expect to hit.
 */
export const TTS_MAX_INPUT_CHARS = 4096;
