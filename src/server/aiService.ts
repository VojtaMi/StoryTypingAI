import Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import type { ChatMessage } from "../ai";
import { DEFAULT_TEXT_MODEL } from "../models";
import { normalizeStoryText } from "./http";

export async function completeAi(
	openai: OpenAI,
	messages: ChatMessage[],
	maxTokens = 200,
	model = DEFAULT_TEXT_MODEL,
	anthropicKey = "",
): Promise<string> {
	if (model.startsWith("claude-")) {
		return completeAnthropic(messages, maxTokens, model, anthropicKey);
	}
	return completeOpenAi(openai, messages, maxTokens, model);
}

async function completeOpenAi(
	openai: OpenAI,
	messages: ChatMessage[],
	maxTokens: number,
	model: string,
): Promise<string> {
	const response = await openai.chat.completions.create({
		model,
		max_completion_tokens: maxTokens,
		messages,
	});
	const raw = response.choices[0]?.message?.content?.trim();
	if (!raw) throw new Error("The AI returned an empty response.");
	return normalizeStoryText(raw);
}

async function completeAnthropic(
	messages: ChatMessage[],
	maxTokens: number,
	model: string,
	apiKey: string,
): Promise<string> {
	if (!apiKey) throw new Error("Anthropic API key is not configured.");
	const anthropic = new Anthropic({ apiKey });

	const systemContent = messages
		.filter((m) => m.role === "system")
		.map((m) => m.content)
		.join("\n\n");

	const conversationMessages = messages
		.filter((m) => m.role !== "system")
		.map((m) => ({
			role: m.role as "user" | "assistant",
			content: m.content,
		}));

	const response = await anthropic.messages.create({
		model,
		max_tokens: maxTokens,
		...(systemContent ? { system: systemContent } : {}),
		messages: conversationMessages,
	});

	const block = response.content[0];
	if (block?.type !== "text")
		throw new Error("The AI returned an empty response.");
	return normalizeStoryText(block.text);
}
