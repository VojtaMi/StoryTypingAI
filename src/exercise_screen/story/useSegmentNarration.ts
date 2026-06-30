import { useCallback, useEffect, useRef, useState } from "react";
import { speakStorySegment } from "../../ai";

export type NarrationStatus = "idle" | "loading" | "playing" | "error";

/**
 * Plays story segment narration. Segments with prepared audio replay that stable
 * MP3 URL; older segments without saved audio fall back to lazy TTS generation.
 * A single shared <audio> element guarantees only one segment plays at a time.
 */
export function useSegmentNarration() {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const urlCacheRef = useRef(new Map<string, string>());
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
		const cache = urlCacheRef.current;
		return () => {
			audio.removeEventListener("ended", handleEnd);
			audio.pause();
			for (const url of cache.values()) URL.revokeObjectURL(url);
			cache.clear();
		};
	}, []);

	const toggle = useCallback(
		async ({
			key,
			text,
			audioUrl,
		}: {
			key: string;
			text: string;
			audioUrl?: string | null;
		}) => {
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
			setActiveKey(key);
			setStatus("loading");
			try {
				let url = audioUrl ?? urlCacheRef.current.get(text);
				if (!url) {
					const blob = await speakStorySegment(text);
					url = URL.createObjectURL(blob);
					urlCacheRef.current.set(text, url);
				}
				audio.src = url;
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
