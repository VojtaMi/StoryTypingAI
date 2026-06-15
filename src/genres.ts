export type GenreId = "fantasy" | "scifi" | "horror";

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
	"Write vivid, immersive prose. Each segment must be at most 4 sentences — prefer density and specificity over length. " +
	"The user adds their own continuations; build on them naturally and keep the story coherent. " +
	"End each segment with a concrete sensory beat that implies the character must act or decide — " +
	"a sound, a sight, a threshold not yet crossed. Do not resolve it. " +
	"Output only the story prose — no titles, headings, meta-commentary, or instructions to the user.";

export const genres: Genre[] = [
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
			"rogue AI",
			"alien artifact",
			"abandoned colony",
			"wormhole",
			"bioengineered megacity",
			"rebel outpost",
			"first contact",
			"nano-plague",
			"cryogenic revival",
			"orbital ring",
			"synthetic consciousness",
			"derelict satellite",
			"ice moon excavation",
			"generation ship",
			"plasma storm",
			"quantum anomaly",
			"battle mech",
			"desert planet",
			"time loop station",
			"submarine city",
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
