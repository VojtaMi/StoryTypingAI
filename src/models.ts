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
