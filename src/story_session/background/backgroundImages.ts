import type { ChatMessage } from "../../ai";
import { type Language, languageHeroImageUrl } from "../../languages";
import type { StoryBackgroundImage } from "../../storyBackground";

export interface StoryBackgroundFields {
	backgroundImageUrl?: string;
	backgroundImagePrompt?: string;
	backgroundImageSource?: string;
}

export function fallbackBackgroundImage(
	selected: Language,
): StoryBackgroundImage {
	return {
		backgroundImageUrl: languageHeroImageUrl(selected),
		backgroundImageSource: "fallback",
	};
}

export function backgroundFromOpening(
	opening: StoryBackgroundFields,
	selected: Language,
): StoryBackgroundImage {
	if (
		opening.backgroundImageUrl &&
		(opening.backgroundImageSource === "generated" ||
			opening.backgroundImageSource === "fallback")
	) {
		return {
			backgroundImageUrl: opening.backgroundImageUrl,
			backgroundImagePrompt: opening.backgroundImagePrompt,
			backgroundImageSource: opening.backgroundImageSource,
		};
	}
	return fallbackBackgroundImage(selected);
}

export function shouldGenerateNextBackground(storyMessages: ChatMessage[]) {
	const assistantCount = storyMessages.filter(
		(message) => message.role === "assistant",
	).length;
	return assistantCount > 1 && assistantCount % 2 === 1;
}

/**
 * Which reading sections get their own background image. A reading story knows
 * all its sections up front, so the cadence is a property of the section number
 * rather than of how much history has accumulated: sections 1, 3 and 5 get an
 * image, and the even sections keep the one before them on screen.
 */
export function shouldGenerateReadingBackground(partIndex: number) {
	return partIndex % 2 === 1;
}

const SECTION_IMAGE_PATTERN = /section_(\d+)\.[a-z0-9]+$/i;

export function buildSectionImageMap(
	imageUrls: string[],
): Record<number, StoryBackgroundImage> {
	const map: Record<number, StoryBackgroundImage> = {};
	for (const url of imageUrls) {
		const match = SECTION_IMAGE_PATTERN.exec(url);
		const section = match ? Number(match[1]) : Number.NaN;
		if (Number.isFinite(section)) {
			map[section] = {
				backgroundImageUrl: url,
				backgroundImageSource: "generated",
			};
		}
	}
	return map;
}
