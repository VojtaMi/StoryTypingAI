export type GenreId = "esperanto" | "fantasy" | "scifi" | "horror";

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

const sharedStyleGuide =
	"You are a collaborative storyteller co-writing an interactive story with the user. " +
	"Each segment is also a typing exercise, so it must be a self-contained, fully formed piece of text. " +
	"Write vivid, immersive prose in 2 to 4 sentences, roughly 40 to 80 words — prefer density and specificity over length. " +
	"Always complete your final sentence; never stop mid-sentence or mid-word. " +
	"The user adds their own continuations; build on them naturally and keep the story coherent. " +
	"End each segment with a concrete sensory beat that implies the character must act or decide — " +
	"a sound, a sight, a threshold not yet crossed. Do not resolve it. " +
	"Output only plain story prose — no Markdown formatting, titles, headings, meta-commentary, or instructions to the user.";

export const genres: Genre[] = [
	{
		id: "esperanto",
		label: "Esperanto",
		emoji: "★",
		color: "#38b26d",
		systemPrompt:
			`${sharedStyleGuide} The genre is a gentle beginner Esperanto lesson told as a tiny story. ` +
			"Use very simple Esperanto sentences with clear context. Favor beginner words such as estas, hundo, besto, mi, homo, and mia. " +
			"Keep the language encouraging, concrete, and easy to type.",
		seeds: [
			"estas",
			"hundo",
			"besto",
			"mi",
			"homo",
			"mia hundo",
			"bruna",
			"amiko",
			"saluton",
			"domo",
		],
	},
	{
		id: "fantasy",
		label: "Fantasy",
		emoji: "🐉",
		color: "#bb9af7",
		systemPrompt: `${sharedStyleGuide} The genre is high fantasy: magic, mythical creatures, ancient kingdoms, and epic quests.`,
		seeds: [
			"dragon",
			"enchanted forest",
			"ancient ruins",
			"dark wizard",
			"cursed artifact",
			"sea serpent",
			"elemental magic",
			"hidden kingdom",
			"crystal cave",
			"prophecy",
			"shapeshifter",
			"dwarf mines",
			"undead army",
			"phoenix",
			"labyrinth",
			"sacred grove",
			"time magic",
			"merchant caravan",
			"plague spirit",
			"sunken temple",
		],
	},
	{
		id: "scifi",
		label: "Sci-Fi",
		emoji: "🚀",
		color: "#7aa2f7",
		systemPrompt: `${sharedStyleGuide} The genre is science fiction: distant futures, advanced technology, alien worlds, and the unknown reaches of space.`,
		seeds: [
			// wonder / positive
			"optimism",
			"aspiration",
			"uplift",
			"gratitude",
			"living",
			"terraforming",
			"solarpunk",
			"good AI",
			// neutral / adventure
			"first contact",
			"wormhole",
			"nebula",
			"black hole",
			"generation ship",
			"orbital ring",
			"o'neill cylinder",
			"ice",
			"artifact",
			"consciousness",
			"robots",
			"quantum",
			"time",
			"planet",
			"sea",
			// dark / tension
			"AI conflict",
			"abandoned",
			"outpost",
			"disease",
			"foreign",
			"battle mech",
			"plasma storm",
		],
	},
	{
		id: "horror",
		label: "Horror",
		emoji: "👻",
		color: "#f7768e",
		systemPrompt: `${sharedStyleGuide} The genre is horror: dread, the uncanny, creeping tension, and things that should not be. Keep it unsettling but not gratuitously graphic.`,
		seeds: [
			"abandoned hospital",
			"cursed painting",
			"doppelganger",
			"sealed basement",
			"possessed doll",
			"missing children",
			"crumbling lighthouse",
			"underground cult",
			"sleep paralysis",
			"mimic creature",
			"psychic vision",
			"vanishing town",
			"ritual circle",
			"wendigo",
			"memory gap",
			"ticking walls",
			"wrong reflection",
			"drowned church",
			"static voice",
			"hollow scarecrow",
		],
	},
];
