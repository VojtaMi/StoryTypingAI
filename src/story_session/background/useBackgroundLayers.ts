import { type CSSProperties, useEffect, useRef, useState } from "react";
import type { StoryBackgroundImage } from "../../storyBackground";

const BACKGROUND_FADE_DURATION_MS = 1200;

export function backgroundLayerStyle(url: string): CSSProperties {
	return { "--background-url": `url("${url}")` } as CSSProperties;
}

export function useBackgroundLayers(
	view:
		| "menu"
		| "lessons-menu"
		| "esperanto-intro"
		| "lesson"
		| "word-match"
		| "lesson-typing"
		| "keyboard-intro"
		| "keyboard-words"
		| "keyboard-word-match"
		| "garden-lesson"
		| "garden-word-match"
		| "garden-phrase-builder"
		| "garden-typing"
		| "story",
	backgroundImage: StoryBackgroundImage | null,
) {
	const [visibleBackgroundUrl, setVisibleBackgroundUrl] = useState<
		string | null
	>(null);
	const [previousBackgroundUrl, setPreviousBackgroundUrl] = useState<
		string | null
	>(null);
	const [isBackgroundFading, setIsBackgroundFading] = useState(false);
	const backgroundFadeTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		const nextUrl =
			view === "story" ? (backgroundImage?.backgroundImageUrl ?? null) : null;

		if (backgroundFadeTimeoutRef.current !== null) {
			window.clearTimeout(backgroundFadeTimeoutRef.current);
			backgroundFadeTimeoutRef.current = null;
		}

		if (!nextUrl) {
			setVisibleBackgroundUrl(null);
			setPreviousBackgroundUrl(null);
			setIsBackgroundFading(false);
			return;
		}

		if (!visibleBackgroundUrl) {
			setVisibleBackgroundUrl(nextUrl);
			setPreviousBackgroundUrl(null);
			setIsBackgroundFading(false);
			return;
		}

		if (visibleBackgroundUrl === nextUrl) return;

		setPreviousBackgroundUrl(visibleBackgroundUrl);
		setVisibleBackgroundUrl(nextUrl);
		setIsBackgroundFading(true);
		backgroundFadeTimeoutRef.current = window.setTimeout(() => {
			setPreviousBackgroundUrl(null);
			setIsBackgroundFading(false);
			backgroundFadeTimeoutRef.current = null;
		}, BACKGROUND_FADE_DURATION_MS);

		return () => {
			if (backgroundFadeTimeoutRef.current !== null) {
				window.clearTimeout(backgroundFadeTimeoutRef.current);
				backgroundFadeTimeoutRef.current = null;
			}
		};
	}, [view, backgroundImage, visibleBackgroundUrl]);

	return {
		visibleBackgroundUrl,
		previousBackgroundUrl,
		isBackgroundFading,
	};
}
