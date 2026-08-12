export type GenreId = "german";

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
		id: "german",
		label: "German",
		emoji: "★",
		color: "#38b26d",
		systemPrompt:
			"Create an engaging German story of your choice. Write the story prose in clear, natural German for a true beginner; keep explanations and metadata in English.",
		seeds: [],
	},
];
