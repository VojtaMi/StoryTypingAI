import type OpenAI from "openai";
import type { ChatMessage } from "../ai";
import { DEFAULT_TEXT_MODEL } from "../models";
import { completeAi } from "./aiService";

const REFINE_MAX_TOKENS = 700;

const REFINE_SYSTEM_PROMPT =
	"You maintain a one-page tutor's handout describing a single Esperanto learner. " +
	"The handout is markdown with YAML frontmatter (level, updated) and these sections: " +
	"Confident, Currently learning (their edge), Shaky / watch for, About this learner. " +
	"You are given the current handout and a transcript of questions the learner just asked the tutor bot. " +
	"A learner's question is a strong signal that the word or grammar concept is new or weak for them; " +
	"fold those into 'Shaky / watch for' or 'Currently learning'. Confirmed comfort can move items into 'Confident'. " +
	"Rewrite and REPLACE the whole handout — never append or let it grow beyond about one page. Keep it concise and factual. " +
	"Update the 'updated' frontmatter date. If the transcript reveals nothing new, return the handout unchanged except that date. " +
	"Return only the markdown handout, with no commentary or code fences.";

/**
 * Folds a tutor-chat transcript into the durable learner handout. Modeled on the
 * story-memory summarizer: replace, don't append, and stay bounded. Returns the
 * current profile unchanged when the transcript carries no learner turns.
 */
export async function refineLearnerProfile(
	openai: OpenAI,
	currentProfile: string,
	chatMessages: ChatMessage[],
	anthropicKey: string,
	today: string,
): Promise<string> {
	const transcript = chatMessages
		.filter((message) => message.role !== "system")
		.map((message) => `${message.role.toUpperCase()}: ${message.content}`)
		.join("\n\n");
	if (!transcript.trim()) return currentProfile;

	const messages: ChatMessage[] = [
		{ role: "system", content: REFINE_SYSTEM_PROMPT },
		{
			role: "user",
			content:
				`Today's date: ${today}\n\n` +
				`Current handout:\n${currentProfile}\n\n` +
				`Learner's tutor questions this session:\n${transcript}\n\n` +
				"Return the updated handout only.",
		},
	];

	return completeAi(
		openai,
		messages,
		REFINE_MAX_TOKENS,
		DEFAULT_TEXT_MODEL,
		anthropicKey,
	);
}
