import { traceAiCall } from "../aiTrace";
import type {
	GeminiImageModel,
	GeneratedStoryImage,
	ProviderImageRequest,
} from "./types";

export const GEMINI_FLASH_IMAGE_MODEL: GeminiImageModel =
	"gemini-3.1-flash-image";
export const GEMINI_FLASH_LITE_IMAGE_MODEL: GeminiImageModel =
	"gemini-3.1-flash-lite-image";
export const GEMINI_IMAGE_MODEL = GEMINI_FLASH_IMAGE_MODEL;

type GeminiGenerateContentResponse = {
	candidates?: Array<{
		content?: {
			parts?: Array<{
				inlineData?: {
					data?: string;
					mimeType?: string;
				};
				text?: string;
			}>;
		};
	}>;
};

export async function generateGeminiImage({
	geminiModel = GEMINI_IMAGE_MODEL,
	prompt,
}: ProviderImageRequest): Promise<GeneratedStoryImage> {
	const apiKey = process.env.GEMINI_API_KEY ?? "";
	if (!apiKey) throw new Error("Gemini API key is not configured.");

	const body = {
		contents: [{ parts: [{ text: prompt }] }],
	};
	const inlineData = await traceAiCall(
		{
			kind: "image.generate",
			provider: "gemini",
			model: geminiModel,
			input: body,
		},
		async () => {
			const response = await fetch(
				`https://generativelanguage.googleapis.com/v1/models/${geminiModel}:generateContent`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-goog-api-key": apiKey,
					},
					body: JSON.stringify(body),
				},
			);

			if (!response.ok) {
				throw new Error(
					`Gemini image request failed: ${response.status} ${response.statusText}`,
				);
			}

			const json = (await response.json()) as GeminiGenerateContentResponse;
			const inlineData = json.candidates?.[0]?.content?.parts?.find(
				(part) => part.inlineData,
			)?.inlineData;
			if (!inlineData?.data) {
				throw new Error("Gemini image response did not include image data.");
			}

			return {
				data: inlineData.data,
				mimeType: inlineData.mimeType,
			};
		},
		(value) => ({
			imageChars: value.data?.length ?? 0,
			mimeType: value.mimeType,
		}),
	);
	const mimeType = imageMimeType(inlineData.mimeType);

	return {
		extension: imageExtension(mimeType),
		image: Buffer.from(inlineData.data, "base64"),
		mimeType,
		model: geminiModel,
		prompt,
		provider: "gemini",
	};
}

function imageMimeType(
	value: string | undefined,
): GeneratedStoryImage["mimeType"] {
	if (value === "image/png" || value === "image/webp") return value;
	return "image/jpeg";
}

function imageExtension(
	mimeType: GeneratedStoryImage["mimeType"],
): GeneratedStoryImage["extension"] {
	if (mimeType === "image/png") return "png";
	if (mimeType === "image/webp") return "webp";
	return "jpg";
}
