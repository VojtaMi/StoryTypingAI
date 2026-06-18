import Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import type { ChatMessage } from "../ai";
import {
	DEFAULT_TEXT_MODEL,
	STORY_SEGMENT_MAX_TOKENS,
	TTS_MAX_INPUT_CHARS,
	TTS_MODEL,
	TTS_VOICE,
} from "../models";
import { normalizeStoryText } from "./http";

type AnthropicMessages = {
	systemContent: string;
	conversationMessages: Array<{
		role: "user" | "assistant";
		content: string;
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
