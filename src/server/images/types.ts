import type OpenAI from "openai";
import type { Language } from "../../languages";

export type ImageProvider = "openai" | "gemini";
export type ImageProviderPreference = ImageProvider | "auto";
export type GeminiImageModel =
	| "gemini-3.1-flash-image"
	| "gemini-3.1-flash-lite-image";

export interface StoryImageRequest {
	genre: Language;
	geminiModel?: GeminiImageModel;
	openai: OpenAI;
	provider?: ImageProviderPreference;
	/**
	 * An earlier image of this story, attached to hold the characters' identity
	 * steady across sections. Only the OpenAI provider uses it.
	 */
	referenceImage?: Buffer;
	storyText: string;
	visualContext?: string;
}

export interface ProviderImageRequest {
	geminiModel?: GeminiImageModel;
	prompt: string;
	openai: OpenAI;
	referenceImage?: Buffer;
}

export interface GeneratedStoryImage {
	extension: "jpg" | "png" | "webp";
	image: Buffer;
	mimeType: "image/jpeg" | "image/png" | "image/webp";
	model: string;
	prompt: string;
	provider: ImageProvider;
}
