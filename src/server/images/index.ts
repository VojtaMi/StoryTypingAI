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
	referenceImage,
	storyText,
	visualContext,
}: StoryImageRequest): Promise<GeneratedStoryImage> {
	const requestedProvider =
		provider === "auto"
			? process.env.GEMINI_API_KEY
				? "gemini"
				: "openai"
			: provider;

	// Only the OpenAI path attaches the reference, so only it earns the extra
	// instruction that tells the model what the attachment is for.
	const anchored = Boolean(referenceImage) && requestedProvider === "openai";
	const prompt = buildStoryBackgroundPrompt(
		genre,
		storyText,
		visualContext,
		anchored,
	);

	if (requestedProvider === "gemini") {
		return generateGeminiImage({ geminiModel, openai, prompt });
	}

	return generateOpenAiImage({
		openai,
		prompt,
		referenceImage: anchored ? referenceImage : undefined,
	});
}
