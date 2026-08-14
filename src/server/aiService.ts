import Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import type { ChatMessage } from "../ai";
import {
	DEFAULT_TEXT_MODEL,
	reasoningEffortForModel,
	STORY_SEGMENT_MAX_TOKENS,
	TTS_MAX_INPUT_CHARS,
	TTS_MODEL,
	TTS_VOICE,
	thinkingLevelForModel,
} from "../models";
import { normalizeStoryText } from "./http";

type AnthropicMessages = {
	systemContent: string;
	conversationMessages: Array<{
		role: "user" | "assistant";
		content: string;
	}>;
};

type GeminiGenerateContentResponse = {
	candidates?: Array<{
		content?: { parts?: Array<{ text?: string }> };
		finishReason?: string;
	}>;
};

const GEMINI_MIN_OUTPUT_TOKENS = 800;

export async function completeAi(
	openai: OpenAI,
	messages: ChatMessage[],
	maxTokens = STORY_SEGMENT_MAX_TOKENS,
	model = DEFAULT_TEXT_MODEL,
	anthropicKey = "",
	geminiKey = "",
): Promise<string> {
	if (model.startsWith("claude-")) {
		return completeAnthropic(messages, maxTokens, model, anthropicKey);
	}
	if (model.startsWith("gemini-")) {
		return completeGemini(messages, maxTokens, model, geminiKey);
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
	geminiKey = "",
): Promise<string> {
	if (model.startsWith("claude-")) {
		return streamAnthropic(messages, maxTokens, model, anthropicKey, onChunk);
	}
	if (model.startsWith("gemini-")) {
		const text = await completeGemini(messages, maxTokens, model, geminiKey);
		onChunk(text);
		return text;
	}
	return streamOpenAi(openai, messages, maxTokens, model, onChunk);
}

/**
 * Synthesizes narration for a single story segment. Returns raw MP3 bytes so the
 * caller can stream them straight back to the browser without touching disk.
 */
export async function synthesizeSpeech(
	openai: OpenAI,
	text: string,
): Promise<Buffer> {
	const input = text.trim();
	if (!input) throw new Error("No text to narrate.");
	if (input.length > TTS_MAX_INPUT_CHARS) {
		throw new Error("The passage is too long to narrate.");
	}

	const response = await openai.audio.speech.create({
		model: TTS_MODEL,
		voice: TTS_VOICE,
		input,
		response_format: "mp3",
	});
	return Buffer.from(await response.arrayBuffer());
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
		reasoning_effort: reasoningEffortForModel(model),
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
		reasoning_effort: reasoningEffortForModel(model),
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

	const raw = response.content
		.map((block) => (block.type === "text" ? block.text : ""))
		.join("")
		.trim();
	if (!raw) throw new Error("The AI returned an empty response.");
	const text = normalizeStoryText(raw);
	return response.stop_reason === "max_tokens"
		? trimToSentenceBoundary(text)
		: text;
}

async function completeGemini(
	messages: ChatMessage[],
	maxTokens: number,
	model: string,
	apiKey: string,
): Promise<string> {
	if (!apiKey) throw new Error("Gemini API key is not configured.");
	const systemContent = messages
		.filter(({ role }) => role === "system")
		.map(({ content }) => content)
		.join("\n\n");
	const contents = messages
		.filter(({ role }) => role !== "system")
		.map(({ role, content }) => ({
			role: role === "assistant" ? "model" : "user",
			parts: [{ text: content }],
		}));
	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-goog-api-key": apiKey,
			},
			body: JSON.stringify({
				contents,
				generationConfig: {
					maxOutputTokens: Math.max(maxTokens, GEMINI_MIN_OUTPUT_TOKENS),
					thinkingConfig: {
						thinkingLevel: thinkingLevelForModel(model) ?? "low",
					},
				},
				...(systemContent
					? { systemInstruction: { parts: [{ text: systemContent }] } }
					: {}),
			}),
		},
	);
	if (!response.ok) {
		throw new Error(
			`Gemini request failed: ${response.status} ${response.statusText}`,
		);
	}
	const body = (await response.json()) as GeminiGenerateContentResponse;
	const choice = body.candidates?.[0];
	const raw = choice?.content?.parts
		?.map(({ text }) => text ?? "")
		.join("")
		.trim();
	if (!raw) throw new Error("The AI returned an empty response.");
	const text = normalizeStoryText(raw);
	return choice?.finishReason === "MAX_TOKENS"
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
