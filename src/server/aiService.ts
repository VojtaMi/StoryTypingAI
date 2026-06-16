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

export async function streamAi(
	openai: OpenAI,
	messages: ChatMessage[],
	maxTokens = 200,
	model = DEFAULT_TEXT_MODEL,
	anthropicKey = "",
	onChunk: (chunk: string) => void,
): Promise<string> {
	if (model.startsWith("claude-")) {
		return streamAnthropic(messages, maxTokens, model, anthropicKey, onChunk);
	}
	return streamOpenAi(openai, messages, maxTokens, model, onChunk);
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

async function streamOpenAi(
	openai: OpenAI,
	messages: ChatMessage[],
	maxTokens: number,
	model: string,
	onChunk: (chunk: string) => void,
): Promise<string> {
	const stream = await openai.chat.completions.create({
		model,
		max_completion_tokens: maxTokens,
		messages,
		stream: true,
	});

	let raw = "";
	for await (const event of stream) {
		const chunk = event.choices[0]?.delta.content;
		if (!chunk) continue;
		raw += chunk;
		onChunk(normalizeStoryText(chunk));
	}

	const text = normalizeStoryText(raw).trim();
	if (!text) throw new Error("The AI returned an empty response.");
	return text;
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

async function streamAnthropic(
	messages: ChatMessage[],
	maxTokens: number,
	model: string,
	apiKey: string,
	onChunk: (chunk: string) => void,
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

	const stream = await anthropic.messages.create({
		model,
		max_tokens: maxTokens,
		...(systemContent ? { system: systemContent } : {}),
		messages: conversationMessages,
		stream: true,
	});

	let raw = "";
	for await (const event of stream) {
		if (
			event.type !== "content_block_delta" ||
			event.delta.type !== "text_delta"
		) {
			continue;
		}
		raw += event.delta.text;
		onChunk(normalizeStoryText(event.delta.text));
	}

	const text = normalizeStoryText(raw).trim();
	if (!text) throw new Error("The AI returned an empty response.");
	return text;
}
