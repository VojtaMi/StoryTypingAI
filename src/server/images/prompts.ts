import type { Genre } from "../../genres";

export function buildStoryBackgroundPrompt(
	genre: Genre,
	storyText: string,
	visualContext?: string,
) {
	return [
		"Create a cinematic full-page background image",
		`Genre: ${genre.label}.`,
		visualContext
			? `Visual continuity to preserve across images: ${visualContext}`
			: "",
		`Story opening: ${storyText}`,
		"Use a 3:2 landscape composition",
		"Put details toward the edges rather than behind the center.",
	]
		.filter(Boolean)
		.join("\n");
}
