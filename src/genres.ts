export type GenreId = "spanish";

export interface Genre {
	id: GenreId;
	label: string;
	emoji: string;
	/** Accent color used to tint the menu circle. */
	color: string;
	/** System prompt that sets the tone for this genre's story. */
	systemPrompt: string;
	/** Random seed words injected into opening generation to vary themes. */
	seeds: string[];
}

export const genres: Genre[] = [
	{
		id: "spanish",
		label: "Spanish",
		emoji: "★",
		color: "#38b26d",
		systemPrompt: "Create an engaging Spanish story of your choice.",
		seeds: [],
	},
];
