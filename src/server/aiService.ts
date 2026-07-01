import Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import type { ChatMessage } from "../ai";
import {
	DEFAULT_TEXT_MODEL,
	STORY_SEGMENT_MAX_TOKENS,
	TRANSLATION_MODEL,
} from "../models";
import { normalizeStoryText } from "./http";

type AnthropicMessages = {
	systemContent: string;
	conversationMessages: Array<{
		role: "user" | "assistant";
		content: string;
	}>;
};

type GeminiContent = {
	role: "user" | "model";
	parts: Array<{ text: string }>;
};

type GeminiGenerateContentResponse = {
	candidates?: Array<{
		content?: {
			parts?: Array<{ text?: string }>;
		};
		finishReason?: string;
	}>;
};

export async function completeAi(
	openai: OpenAI,
	messages: ChatMessage[],
	maxTokens = STORY_SEGMENT_MAX_TOKENS,
	model = DEFAULT_TEXT_MODEL,
	anthropicKey = "",
): Promise<string> {
	if (model.startsWith("claude-")) {
		return completeAnthropic(messages, maxTokens, model, anthropicKey);
	}
	if (model.startsWith("gemini-")) {
		return completeGemini(messages, maxTokens, model);
	}
	return completeOpenAi(openai, messages, maxTokens, model);
}

export async function streamAi(
	openai: OpenAI,
	messages: ChatMessage[],
	maxTokens = STORY_SEGMENT_MAX_TOKENS,
	model = DEFAULT_TEXT_MODEL,
	anthropicKey = "",
	onChunk: (chunk: string) => void,
): Promise<string> {
	if (model.startsWith("claude-")) {
		return streamAnthropic(messages, maxTokens, model, anthropicKey, onChunk);
	}
	if (model.startsWith("gemini-")) {
		return streamGemini(messages, maxTokens, model, onChunk);
	}
	return streamOpenAi(openai, messages, maxTokens, model, onChunk);
}

export async function translateWords(
	openai: OpenAI,
	words: string[],
): Promise<Record<string, string>> {
	if (words.length === 0) return {};
	const response = await openai.chat.completions.create({
		model: TRANSLATION_MODEL,
		max_completion_tokens: 4000,
		messages: [
			{
				role: "system",
				content:
					"You are an Esperanto-English dictionary. Given a JSON array of Esperanto words, return a JSON object where each key is the word and the value is its most common English translation. Return only the JSON object, no other text.",
			},
			{ role: "user", content: JSON.stringify(words) },
		],
	});
	const raw = response.choices[0]?.message?.content?.trim() ?? "";
	try {
		return JSON.parse(raw) as Record<string, string>;
	} catch {
		console.warn("translateWords: could not parse AI response", raw);
		return {};
	}
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
	const choice = response.choices[0];
	const raw = choice?.message?.content?.trim();
	if (!raw) throw new Error("The AI returned an empty response.");
	const text = normalizeStoryText(raw);
	return choice?.finish_reason === "length"
		? trimToSentenceBoundary(text)
		: text;
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
	let truncated = false;
	for await (const event of stream) {
		const choice = event.choices[0];
		if (choice?.finish_reason === "length") truncated = true;
		const chunk = choice?.delta.content;
		if (!chunk) continue;
		raw += chunk;
		onChunk(normalizeStoryText(chunk));
	}

	const text = normalizeStoryText(raw).trim();
	if (!text) throw new Error("The AI returned an empty response.");
	return truncated ? trimToSentenceBoundary(text) : text;
}

async function completeAnthropic(
	messages: ChatMessage[],
	maxTokens: number,
	model: string,
	apiKey: string,
): Promise<string> {
	if (!apiKey) throw new Error("Anthropic API key is not configured.");
	const anthropic = new Anthropic({ apiKey });
	const { systemContent, conversationMessages } = toAnthropicMessages(messages);

	const response = await anthropic.messages.create({
		model,
		max_tokens: maxTokens,
		...(systemContent ? { system: systemContent } : {}),
		messages: conversationMessages,
	});

	const block = response.content[0];
	if (block?.type !== "text")
		throw new Error("The AI returned an empty response.");
	const text = normalizeStoryText(block.text);
	return response.stop_reason === "max_tokens"
		? trimToSentenceBoundary(text)
		: text;
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
	const { systemContent, conversationMessages } = toAnthropicMessages(messages);

	const stream = await anthropic.messages.create({
		model,
		max_tokens: maxTokens,
		...(systemContent ? { system: systemContent } : {}),
		messages: conversationMessages,
		stream: true,
	});

	let raw = "";
	let stopReason: string | null = null;
	for await (const event of stream) {
		if (event.type === "message_delta") {
			stopReason = event.delta.stop_reason ?? stopReason;
			continue;
		}
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
	return stopReason === "max_tokens" ? trimToSentenceBoundary(text) : text;
}

async function completeGemini(
	messages: ChatMessage[],
	maxTokens: number,
	model: string,
): Promise<string> {
	const response = await requestGemini(messages, maxTokens, model);
	const choice = response.candidates?.[0];
	const raw = choice?.content?.parts
		?.map((part) => part.text ?? "")
		.join("")
		.trim();
	if (!raw) throw new Error("The AI returned an empty response.");
	const text = normalizeStoryText(raw);
	return choice?.finishReason === "MAX_TOKENS"
		? trimToSentenceBoundary(text)
		: text;
}

async function streamGemini(
	messages: ChatMessage[],
	maxTokens: number,
	model: string,
	onChunk: (chunk: string) => void,
): Promise<string> {
	const text = await completeGemini(messages, maxTokens, model);
	onChunk(text);
	return text;
}

async function requestGemini(
	messages: ChatMessage[],
	maxTokens: number,
	model: string,
): Promise<GeminiGenerateContentResponse> {
	const apiKey = process.env.GEMINI_API_KEY ?? "";
	if (!apiKey) throw new Error("Gemini API key is not configured.");
	const { systemContent, conversationMessages } = toGeminiMessages(messages);

	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-goog-api-key": apiKey,
			},
			body: JSON.stringify({
				contents: conversationMessages,
				generationConfig: {
					maxOutputTokens: maxTokens,
				},
				...(systemContent
					? {
							systemInstruction: {
								parts: [{ text: systemContent }],
							},
						}
					: {}),
			}),
		},
	);

	if (!response.ok) {
		throw new Error(
			`Gemini request failed: ${response.status} ${response.statusText}`,
		);
	}

	return (await response.json()) as GeminiGenerateContentResponse;
}

/**
 * When a completion is cut off by the token ceiling, the tail is usually a
 * partial sentence or word. Roll the text back to the last sentence-ending
 * punctuation so a typing exercise never ends on a fragment. Applied only when
 * the model was actually truncated, leaving naturally-finished prose untouched
 * (so intentional endings like a trailing dash survive).
 */
function trimToSentenceBoundary(text: string): string {
	const match = text.match(/^[\s\S]*[.!?]["')\]]*/);
	return match ? match[0].trimEnd() : text;
}

function toAnthropicMessages(messages: ChatMessage[]): AnthropicMessages {
	return {
		systemContent: messages
			.filter((m) => m.role === "system")
			.map((m) => m.content)
			.join("\n\n"),
		conversationMessages: messages
			.filter((m) => m.role !== "system")
			.map((m) => ({
				role: m.role as "user" | "assistant",
				content: m.content,
			})),
	};
}

function toGeminiMessages(messages: ChatMessage[]): {
	systemContent: string;
	conversationMessages: GeminiContent[];
} {
	const systemContent = messages
		.filter((m) => m.role === "system")
		.map((m) => m.content)
		.join("\n\n");
	const conversationMessages = messages
		.filter((m) => m.role !== "system")
		.map<GeminiContent>((m) => ({
			role: m.role === "assistant" ? "model" : "user",
			parts: [{ text: m.content }],
		}));

	return {
		systemContent,
		conversationMessages:
			conversationMessages.length > 0
				? conversationMessages
				: [{ role: "user", parts: [{ text: systemContent }] }],
	};
}
