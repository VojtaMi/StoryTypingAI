export function geminiVoice(voice: string | undefined): string {
	switch (voice) {
		case "marin":
			return "Sulafat";
		case "cedar":
			return "Schedar";
		case "fable":
			return "Puck";
		case "coral":
			return "Aoede";
		case "sage":
			return "Iapetus";
		case "onyx":
			return "Algenib";
		default:
			return voice ?? "Kore";
	}
}
