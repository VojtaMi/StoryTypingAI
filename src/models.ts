export const TEXT_MODELS = [
	{ id: "gpt-5.4-mini", label: "GPT 5.4 mini" },
	{ id: "gpt-5.5", label: "GPT 5.5" },
	{ id: "claude-sonnet-4-6", label: "Claude Sonnet" },
] as const;

export type TextModelId = (typeof TEXT_MODELS)[number]["id"];
export const DEFAULT_TEXT_MODEL: TextModelId = "claude-sonnet-4-6";

/**
 * Token ceiling for a single story segment. This is a safety net, not a length
 * target: the prompt asks for 2-4 sentences (well under this), so a well-formed
 * segment finishes naturally before reaching it. Keeping the ceiling comfortably
 * above the intended length is what stops `max_tokens` from truncating prose
 * mid-sentence.
 */
export const STORY_SEGMENT_MAX_TOKENS = 400;

/** Text-to-speech model and voice used to narrate AI story segments on demand. */
export const TTS_MODEL = "gpt-4o-mini-tts";
export const TTS_VOICE = "fable";

/**
 * Hard character ceiling for a single speech request. The OpenAI speech endpoint
 * rejects input longer than 4096 characters; story segments are far shorter, so
 * this is a safety net rather than a length we expect to hit.
 */
export const TTS_MAX_INPUT_CHARS = 4096;
