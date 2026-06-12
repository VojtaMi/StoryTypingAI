export type BackgroundImageSource = "generated" | "fallback";

export interface StoryBackgroundImage {
	backgroundImageUrl: string;
	backgroundImagePrompt?: string;
	backgroundImageSource: BackgroundImageSource;
}
