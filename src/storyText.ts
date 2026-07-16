/** Makes generated prose practical to reproduce in the typing exercise. */
export function normalizeStoryText(text: string): string {
	return text
		.replace(/[‘’‚‛]/g, "'")
		.replace(/[“”„‟]/g, '"')
		.replace(/\*\*([^*\n]+)\*\*/g, "$1")
		.replace(/(^|[\s(["])(\*([^*\n]+)\*(?=[\s.,;:!?")\]]|$))/g, "$1$3")
		.replace(/–/g, "-")
		.replace(/—/g, "--")
		.replace(/…/g, "...");
}
