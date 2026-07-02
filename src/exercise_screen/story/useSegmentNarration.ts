import { useCallback, useEffect, useRef, useState } from "react";

export type NarrationStatus = "idle" | "loading" | "playing" | "error";

/**
 * Plays story segment narration from its prepared audio URL. Segments without
 * one show an error state instead of falling back to a different TTS voice.
 * A single shared <audio> element guarantees only one segment plays at a time.
 */
export function useSegmentNarration() {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const [activeKey, setActiveKey] = useState<string | null>(null);
	const [status, setStatus] = useState<NarrationStatus>("idle");

	useEffect(() => {
		const audio = new Audio();
		audioRef.current = audio;
		const handleEnd = () => {
			setActiveKey(null);
			setStatus("idle");
		};
		audio.addEventListener("ended", handleEnd);
		return () => {
			audio.removeEventListener("ended", handleEnd);
			audio.pause();
		};
	}, []);

	const toggle = useCallback(
		async ({ key, audioUrl }: { key: string; audioUrl?: string | null }) => {
			const audio = audioRef.current;
			if (!audio) return;

			// Clicking the segment that is currently playing pauses it.
			if (activeKey === key && status === "playing") {
				audio.pause();
				setActiveKey(null);
				setStatus("idle");
				return;
			}

			audio.pause();

			if (!audioUrl) {
				setActiveKey(key);
				setStatus("error");
				return;
			}

			setActiveKey(key);
			setStatus("loading");
			try {
				audio.src = audioUrl;
				audio.currentTime = 0;
				await audio.play();
				setStatus("playing");
			} catch (err) {
				console.warn("Could not narrate the story segment.", err);
				setStatus("error");
				setActiveKey(key);
			}
		},
		[activeKey, status],
	);

	const statusFor = useCallback(
		(key: string): NarrationStatus => (activeKey === key ? status : "idle"),
		[activeKey, status],
	);

	return { toggle, statusFor };
}
