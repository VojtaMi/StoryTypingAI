import type { Genre } from "./genres";

export type ChatMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

export interface ReadingStoryBeat {
	part: number;
	role: string;
	summary: string;
	languageFocus: string;
}

export interface ReadingStoryFrame {
	totalParts: 6;
	level: "beginner";
	premise: string;
	mainCharacter: string;
	mainCharacterVisual: string;
	setting: string;
	beats: ReadingStoryBeat[];
}

/**
 * Runs one non-streaming completion. Each call site supplies its own transport:
 * an HTTP fetch from the browser, an in-process call from the CLI.
 */
export type Complete = (
	messages: ChatMessage[],
	maxTokens: number,
) => Promise<string>;

const TITLE_PROMPT =
	"Create a concise title for this story excerpt. Do not continue the story. Return exactly one title line, 2-6 words, with no quotes, punctuation, headings, or story prose.";

const INTRO_PROMPT =
	"Write a 1-2 sentence second-person character introduction for an interactive story. " +
	"State concretely who the player character is and what brought them to this place. " +
	"Write in English, even if the story opening is in another language. " +
	"Start with 'You'. Output only the introduction — no quotes, no headings.";

const TITLE_MAX_TOKENS = 120;
const INTRO_MAX_TOKENS = 180;
const READING_FRAME_MAX_TOKENS = 900;

const READING_FRAME_PROMPT =
	"Plan a six-part beginner Esperanto reading story. " +
	"Return only valid JSON with this exact shape: " +
	'{"totalParts":6,"level":"beginner","premise":"short English premise","mainCharacter":"short English description","mainCharacterVisual":"concrete hidden visual continuity description","setting":"short English setting","beats":[{"part":1,"role":"beginning","summary":"English beat summary","languageFocus":"English language focus"},{"part":2,"role":"inciting event","summary":"English beat summary","languageFocus":"English language focus"},{"part":3,"role":"first attempt","summary":"English beat summary","languageFocus":"English language focus"},{"part":4,"role":"complication","summary":"English beat summary","languageFocus":"English language focus"},{"part":5,"role":"resolution attempt","summary":"English beat summary","languageFocus":"English language focus"},{"part":6,"role":"ending","summary":"English beat summary","languageFocus":"English language focus"}]} ' +
	"Write the frame fields in English. Use exactly six beats numbered 1 through 6. " +
	"Do not include comments, markdown, prose outside the JSON, trailing commas, or ellipses. " +
	"Use character names that do not look like common Esperanto grammar words; do not use names like Mia. " +
	"mainCharacterVisual is hidden image-generation context: state the main character's age bracket, visual presentation, hair, clothing, recurring object, and any stable distinctive detail. " +
	"Keep the story concrete, warm, and suitable for an absolute beginner.";

const READING_FRAME_REPAIR_PROMPT =
	"Repair this into valid JSON for a six-part beginner Esperanto reading story frame. " +
	"Return only JSON with totalParts 6, level beginner, premise, mainCharacter, mainCharacterVisual, setting, and exactly six beats. " +
	"mainCharacterVisual must be concrete hidden image-generation context with age bracket, visual presentation, hair, clothing, recurring object, and stable distinctive detail. " +
	"Each beat must have part, role, summary, and languageFocus. No markdown, comments, trailing commas, or ellipses.";

export const READING_STORY_TOTAL_PARTS = 6;

const READING_PART_SYSTEM_PROMPT =
	"Write one part of a six-part Esperanto reading story for a beginner. " +
	"Output only Esperanto story prose: no title, no headings, no English, no markdown. " +
	"Use 3-5 short simple sentences. Use concrete vocabulary, natural Esperanto word endings, and helpful repetition. " +
	"Avoid uncommon idioms and unusual metaphorical phrases. Prefer concrete actions and visible details. " +
	"Repeat important nouns instead of relying too much on pronouns. " +
	"Use character names that do not look like common Esperanto grammar words; do not use names like Mia. " +
	"Follow the given frame beat exactly while preserving continuity with previous parts.";

/** Messages that begin a new story. Pass a seed to nudge the opening toward a specific element. */
export function openingMessages(genre: Genre, seed?: string): ChatMessage[] {
	return [
		{ role: "system", content: genre.systemPrompt },
		{
			role: "user",
			content: seed
				? `Begin the story. Seed element: ${seed}.`
				: "Begin the story.",
		},
	];
}

export function readingFrameMessages(genre: Genre): ChatMessage[] {
	return [
		{ role: "system", content: READING_FRAME_PROMPT },
		{
			role: "user",
			content: `Create the reading story frame for this genre: ${genre.label}.\nGenre guidance: ${genre.systemPrompt}`,
		},
	];
}

export function readingPartMessages(
	frame: ReadingStoryFrame,
	partIndex: number,
	previousParts: string[],
): ChatMessage[] {
	const beat = frame.beats[partIndex - 1];
	return [
		{ role: "system", content: READING_PART_SYSTEM_PROMPT },
		{
			role: "user",
			content: JSON.stringify(
				{
					frame,
					currentPart: partIndex,
					currentBeat: beat,
					previousParts,
				},
				null,
				2,
			),
		},
	];
}

export async function generateReadingFrame(
	complete: Complete,
	genre: Genre,
): Promise<ReadingStoryFrame> {
	const raw = await complete(
		readingFrameMessages(genre),
		READING_FRAME_MAX_TOKENS,
	);
	try {
		return parseReadingStoryFrame(raw);
	} catch {
		const repaired = await complete(
			[
				{ role: "system", content: READING_FRAME_REPAIR_PROMPT },
				{ role: "user", content: raw },
			],
			READING_FRAME_MAX_TOKENS,
		);
		return parseReadingStoryFrame(repaired);
	}
}

export function parseReadingStoryFrame(raw: string): ReadingStoryFrame {
	const jsonText = extractJsonObject(raw);
	const parsed = JSON.parse(jsonText) as Partial<ReadingStoryFrame>;
	if (
		parsed.totalParts !== READING_STORY_TOTAL_PARTS ||
		parsed.level !== "beginner" ||
		typeof parsed.premise !== "string" ||
		typeof parsed.mainCharacter !== "string" ||
		typeof parsed.mainCharacterVisual !== "string" ||
		typeof parsed.setting !== "string" ||
		!Array.isArray(parsed.beats) ||
		parsed.beats.length !== READING_STORY_TOTAL_PARTS
	) {
		throw new Error("The AI returned an invalid reading story frame.");
	}

	const beats = parsed.beats.map((beat, index) => {
		if (
			!beat ||
			beat.part !== index + 1 ||
			typeof beat.role !== "string" ||
			typeof beat.summary !== "string" ||
			typeof beat.languageFocus !== "string"
		) {
			throw new Error("The AI returned an invalid reading story beat.");
		}
		return {
			part: beat.part,
			role: beat.role,
			summary: beat.summary,
			languageFocus: beat.languageFocus,
		};
	});

	return {
		totalParts: READING_STORY_TOTAL_PARTS,
		level: "beginner",
		premise: parsed.premise,
		mainCharacter: parsed.mainCharacter,
		mainCharacterVisual: parsed.mainCharacterVisual,
		setting: parsed.setting,
		beats,
	};
}

function extractJsonObject(raw: string): string {
	const trimmed = raw.trim();
	if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
	if (fenced?.[1]) return fenced[1].trim();
	const start = trimmed.indexOf("{");
	const end = trimmed.lastIndexOf("}");
	if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
	return trimmed;
}

/** Creates a concise title for a story excerpt. */
export async function generateTitle(
	complete: Complete,
	storyText: string,
): Promise<string> {
	const text = await complete(
		[
			{ role: "system", content: TITLE_PROMPT },
			{ role: "user", content: storyText },
		],
		TITLE_MAX_TOKENS,
	);
	return text.replace(/^["']|["'.!?]$/g, "").trim();
}

/** Generates a 1-2 sentence second-person intro describing who the player is and what brought them here. */
export async function generateIntro(
	complete: Complete,
	genreLabel: string,
	openingText: string,
): Promise<string> {
	return complete(
		[
			{ role: "system", content: INTRO_PROMPT },
			{ role: "user", content: `${genreLabel} story opening:\n${openingText}` },
		],
		INTRO_MAX_TOKENS,
	);
}
