import type OpenAI from "openai";
import type { ChatMessage } from "../ai";
import { normalizeStoryText } from "./http";

export async function completeAi(
	openai: OpenAI,
	messages: ChatMessage[],
	max_completion_tokens = 200,
) {
	const response = await openai.chat.completions.create({
		model: "gpt-5.4-mini",
		max_completion_tokens: max_completion_tokens,
		messages,
	});
	const raw = response.choices[0]?.message?.content?.trim();
	if (!raw) throw new Error("The AI returned an empty response.");
	return normalizeStoryText(raw);
}
