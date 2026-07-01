import type { Genre } from "../../genres";

export function buildStoryBackgroundPrompt(
	genre: Genre,
	storyText: string,
	visualContext?: string,
) {
	return [
		"Create a cinematic full-page background image for a typing story app.",
		`Genre: ${genre.label}.`,
		visualContext
			? `Visual continuity to preserve across images: ${visualContext}`
			: "",
		`Story opening: ${storyText}`,
		"Use a 3:2 landscape composition suitable for a 1536x1024 desktop background.",
		"Make the scene feel specific to the opening while preserving room for imagination.",
		visualContext
			? "Keep recurring characters the same age, appearance, clothing, and distinctive details unless the scene text explicitly changes them."
			: "",
		"Keep the center area moderately low contrast so a translucent text panel remains readable.",
		"Put brighter highlights and intricate details toward the edges rather than behind the central text.",
		"No text, letters, logos, signage, UI, watermark, signature, or captions.",
	]
		.filter(Boolean)
		.join("\n");
}
