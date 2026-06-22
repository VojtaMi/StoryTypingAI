import { useCallback, useEffect, useRef, useState } from "react";

type OpeningAudioStatus = "idle" | "loading" | "playing" | "blocked" | "error";

const BUTTON_LABEL: Record<OpeningAudioStatus, string> = {
	idle: "Play opening narration",
	loading: "Loading opening narration",
	playing: "Pause opening narration",
	blocked: "Play opening narration",
	error: "Narration failed - click to retry",
};

const BUTTON_GLYPH: Record<OpeningAudioStatus, string> = {
	idle: "▶",
	loading: "...",
	playing: "⏸",
	blocked: "▶",
	error: "!",
};

interface OpeningAudioControlProps {
	audioUrl: string | null;
}

export function OpeningAudioControl({ audioUrl }: OpeningAudioControlProps) {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const [status, setStatus] = useState<OpeningAudioStatus>("idle");

	useEffect(() => {
		if (!audioUrl) {
			setStatus("idle");
			return;
		}

		const audio = new Audio(audioUrl);
		audioRef.current = audio;
		let cancelled = false;

		const handleEnd = () => {
			if (!cancelled) setStatus("idle");
		};
		audio.addEventListener("ended", handleEnd);

		async function playOpeningAudio() {
			setStatus("loading");
			try {
				await audio.play();
				if (!cancelled) setStatus("playing");
			} catch (err) {
				console.warn("Opening audio autoplay was blocked.", err);
				if (!cancelled) setStatus("blocked");
			}
		}

		void playOpeningAudio();

		return () => {
			cancelled = true;
			audio.removeEventListener("ended", handleEnd);
			audio.pause();
			audioRef.current = null;
		};
	}, [audioUrl]);

	const toggle = useCallback(async () => {
		const audio = audioRef.current;
		if (!audio) return;

		if (status === "playing") {
			audio.pause();
			setStatus("idle");
			return;
		}

		setStatus("loading");
		try {
			await audio.play();
			setStatus("playing");
		} catch (err) {
			console.warn("Could not play opening audio.", err);
			setStatus("error");
		}
	}, [status]);

	if (!audioUrl) return null;

	return (
		<button
			type="button"
			className="story__opening-audio"
			data-status={status}
			aria-label={BUTTON_LABEL[status]}
			title={BUTTON_LABEL[status]}
			disabled={status === "loading"}
			onClick={() => void toggle()}
		>
			{BUTTON_GLYPH[status]}
		</button>
	);
}
