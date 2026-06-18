import { useCallback, useEffect, useRef, useState } from "react";
import { speakStorySegment } from "../../ai";

export type NarrationStatus = "idle" | "loading" | "playing" | "error";

/**
 * Lazily narrates story segments. Audio is fetched on first play and cached as an
 * object URL for the rest of the session, keyed by the segment text so identical
 * passages reuse a single blob. A single shared <audio> element guarantees only
 * one segment plays at a time.
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
		async (text: string) => {
			const audio = audioRef.current;
			if (!audio) return;

			// Clicking the segment that is currently playing pauses it.
			if (activeKey === text && status === "playing") {
				audio.pause();
				setActiveKey(null);
				setStatus("idle");
				return;
			}

			audio.pause();
			setActiveKey(text);
			setStatus("loading");
			try {
				let url = urlCacheRef.current.get(text);
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
				setActiveKey(text);
			}
		},
		[activeKey, status],
	);

	const statusFor = useCallback(
		(text: string): NarrationStatus => (activeKey === text ? status : "idle"),
		[activeKey, status],
	);

	return { toggle, statusFor };
}
