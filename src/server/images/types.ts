import type OpenAI from "openai";
import type { Genre } from "../../genres";

export type ImageProvider = "openai" | "gemini";
export type ImageProviderPreference = ImageProvider | "auto";
export type GeminiImageModel =
	| "gemini-3.1-flash-image"
	| "gemini-3.1-flash-lite-image";

export interface StoryImageRequest {
	genre: Genre;
	geminiModel?: GeminiImageModel;
	openai: OpenAI;
	provider?: ImageProviderPreference;
	storyText: string;
	visualContext?: string;
}

export interface ProviderImageRequest {
	geminiModel?: GeminiImageModel;
	prompt: string;
	openai: OpenAI;
}

export interface GeneratedStoryImage {
	extension: "jpg" | "png" | "webp";
	image: Buffer;
	mimeType: "image/jpeg" | "image/png" | "image/webp";
	model: string;
	prompt: string;
	provider: ImageProvider;
}
