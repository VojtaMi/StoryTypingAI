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
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const resumeAfterSeekRef = useRef(false);

	useEffect(() => {
		setCurrentTime(0);
		setDuration(0);

		if (!audioUrl) {
			setStatus("idle");
			return;
		}

		const audio = new Audio(audioUrl);
		audioRef.current = audio;
		let cancelled = false;

		const handleEnd = () => {
			if (cancelled) return;
			setStatus("idle");
			audio.currentTime = 0;
			setCurrentTime(0);
		};
		const handleTimeUpdate = () => {
			if (!cancelled) setCurrentTime(audio.currentTime);
		};
		const handleLoadedMetadata = () => {
			if (!cancelled) setDuration(audio.duration || 0);
		};
		audio.addEventListener("ended", handleEnd);
		audio.addEventListener("timeupdate", handleTimeUpdate);
		audio.addEventListener("loadedmetadata", handleLoadedMetadata);

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
			audio.removeEventListener("timeupdate", handleTimeUpdate);
			audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
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

	const previewSeek = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setCurrentTime(Number(event.target.value));
		},
		[],
	);

	const startSeek = useCallback(() => {
		const audio = audioRef.current;
		if (!audio || audio.paused) return;
		resumeAfterSeekRef.current = true;
		audio.pause();
		setStatus("idle");
	}, []);

	const commitSeek = useCallback(
		async (event: React.SyntheticEvent<HTMLInputElement>) => {
			const audio = audioRef.current;
			if (!audio) return;
			audio.currentTime = Number(event.currentTarget.value);

			if (!resumeAfterSeekRef.current) return;
			resumeAfterSeekRef.current = false;
			setStatus("loading");
			try {
				await audio.play();
				setStatus("playing");
			} catch (err) {
				console.warn("Could not resume opening audio after seeking.", err);
				setStatus("error");
			}
		},
		[],
	);

	if (!audioUrl) return null;

	const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

	return (
		<div className="story__opening-audio-group">
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
			<input
				type="range"
				className="story__opening-audio-bar"
				min={0}
				max={duration || 0}
				step={0.1}
				value={currentTime}
				disabled={!duration}
				aria-label="Seek narration"
				onChange={previewSeek}
				onPointerDown={startSeek}
				onPointerUp={commitSeek}
				onKeyUp={commitSeek}
				style={{ "--progress": `${progress}%` } as React.CSSProperties}
			/>
		</div>
	);
}
