import type { ChatMessage } from "../../ai";
import type { Genre } from "../../genres";
import type { StoryBackgroundImage } from "../../storyBackground";

export interface StoryBackgroundFields {
	backgroundImageUrl?: string;
	backgroundImagePrompt?: string;
	backgroundImageSource?: string;
}

export function fallbackBackgroundImage(selected: Genre): StoryBackgroundImage {
	return {
		backgroundImageUrl: `/images/fallback-${selected.id}.webp`,
		backgroundImageSource: "fallback",
	};
}

export function backgroundFromOpening(
	opening: StoryBackgroundFields,
	selected: Genre,
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
