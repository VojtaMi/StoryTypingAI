import type { ChatMessage, Complete } from "../story";

export interface StoryMemory {
	summary: string;
	summarizedThrough: number;
}

export interface PreparedStoryContext {
	messages: ChatMessage[];
	memory?: StoryMemory;
}

const SUMMARY_TRIGGER_MESSAGE_COUNT = 16;
const RECENT_MESSAGE_COUNT = 10;
const SUMMARY_MAX_TOKENS = 500;

const SUMMARY_SYSTEM_PROMPT =
	"Update the durable memory for an interactive story. " +
	"Preserve plot state, characters, setting, unresolved tension, player choices, important objects, promises, constraints, tone, and point of view. " +
	"Be concise and factual. Do not continue the story.";

const MEMORY_CONTEXT_PREFIX =
	"Story memory so far. Use this as continuity context, but continue from the recent verbatim turns that follow:";

export async function prepareStoryContext(
	fullMessages: ChatMessage[],
	memory: StoryMemory | undefined,
	complete: Complete,
): Promise<PreparedStoryContext> {
	try {
		const nextMemory = await updateStoryMemory(fullMessages, memory, complete);
		return {
			messages: compactMessages(fullMessages, nextMemory),
			memory: nextMemory,
		};
	} catch (err) {
		console.warn("Could not update story memory; using full history.", err);
		return { messages: fullMessages, memory };
	}
}

async function updateStoryMemory(
	fullMessages: ChatMessage[],
	memory: StoryMemory | undefined,
	complete: Complete,
): Promise<StoryMemory | undefined> {
	if (fullMessages.length < SUMMARY_TRIGGER_MESSAGE_COUNT) return memory;

	const summarizeThrough = fullMessages.length - RECENT_MESSAGE_COUNT;
	const currentThrough = memory?.summarizedThrough ?? 0;
	if (summarizeThrough <= currentThrough) return memory;

	const messagesToSummarize = fullMessages
		.slice(currentThrough, summarizeThrough)
		.filter((message) => message.role !== "system");

	if (messagesToSummarize.length === 0) {
		return memory
			? { ...memory, summarizedThrough: summarizeThrough }
			: undefined;
	}

	const summary = await complete(
		[
			{ role: "system", content: SUMMARY_SYSTEM_PROMPT },
			{
				role: "user",
				content: buildSummaryPrompt(memory?.summary, messagesToSummarize),
			},
		],
		SUMMARY_MAX_TOKENS,
	);

	return {
		summary,
		summarizedThrough: summarizeThrough,
	};
}

function compactMessages(
	fullMessages: ChatMessage[],
	memory: StoryMemory | undefined,
): ChatMessage[] {
	if (!memory?.summary) return fullMessages;

	const systemMessages = fullMessages.filter(
		(message) => message.role === "system",
	);
	const recentMessages = fullMessages
		.slice(memory.summarizedThrough)
		.filter((message) => message.role !== "system");

	return [
		...systemMessages,
		{
			role: "system",
			content: `${MEMORY_CONTEXT_PREFIX}\n\n${memory.summary}`,
		},
		...recentMessages,
	];
}

function buildSummaryPrompt(
	previousSummary: string | undefined,
	messagesToSummarize: ChatMessage[],
) {
	const previous = previousSummary
		? `Existing story memory:\n${previousSummary}\n\n`
		: "";
	const newTurns = messagesToSummarize
		.map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
		.join("\n\n");

	return `${previous}New transcript turns to fold into memory:\n${newTurns}\n\nReturn the updated story memory only.`;
}
