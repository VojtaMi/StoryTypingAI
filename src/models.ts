export const TEXT_MODELS = [
	{ id: "gpt-5.6-luna", label: "GPT 5.6 Luna" },
	{ id: "gpt-5.4-mini", label: "GPT 5.4 mini" },
	{ id: "gpt-5.4", label: "GPT 5.4" },
	{ id: "gpt-5.5", label: "GPT 5.5" },
	{ id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
	{ id: "claude-sonnet-5", label: "Claude Sonnet 5" },
	{ id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
	{ id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
	{ id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
	{ id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
] as const;

export type TextModelId = (typeof TEXT_MODELS)[number]["id"];
export const DEFAULT_TEXT_MODEL: TextModelId = "gpt-5.6-luna";

/**
 * Default model for the Esperanto Bot chat. The bot answers short, interactive
 * follow-up questions where latency is felt directly, so it defaults
 * independently of the story-generation model. Users can switch it in
 * the chat UI; the choice persists separately from the story model.
 */
export const DEFAULT_CHAT_MODEL: TextModelId = "gpt-5.6-luna";

/**
 * Token ceiling for a single story segment. This is a safety net, not a length
 * target: the prompt asks for 2-4 sentences (well under this), so a well-formed
 * segment finishes naturally before reaching it. Keeping the ceiling comfortably
 * above the intended length is what stops `max_tokens` from truncating prose
 * mid-sentence.
 */
export const STORY_SEGMENT_MAX_TOKENS = 400;

/**
 * Token ceiling for one complete six-part reading story. A reading story is
 * generated in a single call, so this has to cover all six parts of prose plus
 * the story metadata at once — and, on reasoning models, the reasoning tokens
 * spent on the way there. Sized well above a well-formed story, because a
 * story truncated at the ceiling is thrown away, not shown.
 */
export const READING_STORY_MAX_TOKENS = 4000;

/** Default model used for batch word translations — not user-selectable. */
export const TRANSLATION_MODEL = "gpt-5.6-luna";

/** Default model used for internal memory/refinement tasks — not user-selectable. */
export const SYSTEM_AI_MODEL: TextModelId = "gpt-5.6-luna";
