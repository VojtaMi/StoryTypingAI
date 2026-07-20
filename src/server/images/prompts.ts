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
		`Scene to depict: ${storyText}`,
		"Use a 3:2 landscape composition",
		"Put details toward the edges rather than behind the center.",
		"Most scenes should have no visible text at all. If a sign, poster, or billboard with writing would be natural, include at most one small, secondary instance, not a dominant subject.",
	]
		.filter(Boolean)
		.join("\n");
}
