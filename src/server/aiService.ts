import type OpenAI from "openai";
import type { ChatMessage } from "../ai";
import { normalizeStoryText } from "./http";

export async function completeAi(
	openai: OpenAI,
	messages: ChatMessage[],
	maxTokens = 150,
) {
	const response = await openai.chat.completions.create({
		model: "gpt-4o-mini",
		max_tokens: maxTokens,
		messages,
	});
	const raw = response.choices[0]?.message?.content?.trim();
	if (!raw) throw new Error("The AI returned an empty response.");
	return normalizeStoryText(raw);
}
