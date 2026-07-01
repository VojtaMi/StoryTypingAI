import { generateGeminiImage } from "./geminiImages";
import { generateOpenAiImage } from "./openaiImages";
import { buildStoryBackgroundPrompt } from "./prompts";
import type {
	GeminiImageModel,
	GeneratedStoryImage,
	ImageProvider,
	StoryImageRequest,
} from "./types";

export {
	GEMINI_FLASH_IMAGE_MODEL,
	GEMINI_FLASH_LITE_IMAGE_MODEL,
	GEMINI_IMAGE_MODEL,
} from "./geminiImages";
export { OPENAI_IMAGE_MODEL } from "./openaiImages";
export { buildStoryBackgroundPrompt } from "./prompts";
export type {
	GeminiImageModel,
	GeneratedStoryImage,
	ImageProvider,
	StoryImageRequest,
};

export async function generateStoryImage({
	geminiModel,
	genre,
	openai,
	provider = "openai",
	storyText,
	visualContext,
}: StoryImageRequest): Promise<GeneratedStoryImage> {
	const prompt = buildStoryBackgroundPrompt(genre, storyText, visualContext);
	const requestedProvider =
		provider === "auto"
			? process.env.GEMINI_API_KEY
				? "gemini"
				: "openai"
			: provider;

	if (requestedProvider === "gemini") {
		return generateGeminiImage({ geminiModel, openai, prompt });
	}

	return generateOpenAiImage({ openai, prompt });
}
