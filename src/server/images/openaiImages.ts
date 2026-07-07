import { traceAiCall } from "../aiTrace";
import type { GeneratedStoryImage, ProviderImageRequest } from "./types";

export const OPENAI_IMAGE_MODEL = "gpt-image-2";

export async function generateOpenAiImage({
	openai,
	prompt,
}: ProviderImageRequest): Promise<GeneratedStoryImage> {
	const encoded = await traceAiCall(
		{
			kind: "image.generate",
			provider: "openai",
			model: OPENAI_IMAGE_MODEL,
			input: prompt,
			metadata: {
				n: 1,
				outputFormat: "webp",
				quality: "low",
				size: "1536x1024",
			},
		},
		async () => {
			const response = await openai.images.generate({
				model: OPENAI_IMAGE_MODEL,
				prompt,
				size: "1536x1024",
				quality: "low",
				output_format: "webp",
				n: 1,
			});
			const encoded = response.data?.[0]?.b64_json;
			if (!encoded) throw new Error("The image API returned no image data.");
			return encoded;
		},
		(value) => ({
			imageChars: value.length,
		}),
	);

	return {
		extension: "webp",
		image: Buffer.from(encoded, "base64"),
		mimeType: "image/webp",
		model: OPENAI_IMAGE_MODEL,
		prompt,
		provider: "openai",
	};
}
