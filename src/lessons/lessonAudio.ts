import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLessonAudioUrl, getWordAudioUrl } from "../ai";

export const ESPERANTO_PRONUNCIATION =
	"Legu la tekston kiel klara, natura Esperanto por komencanto. " +
	"Parolu malrapide kaj klare. " +
	"Ĉiu litero estas prononcata; ne ekzistas silentaj literoj. " +
	"La vokaloj estas puraj kaj mallongaj: a, e, i, o, u. " +
	"La akcento ĉiam estas sur la antaŭlasta silabo. " +
	"Prononcu ĉ kiel ch en church, ĝ kiel j en jam, ĥ kiel ch en Czech chod aŭ German Bach, ĵ kiel zh en measure, ŝ kiel sh en ship, kaj ŭ kiel mallonga w-glido en aŭ. " +
	"Evitu anglan diftongon ĉe fina o; tenu o kiel pura Esperanto oh. " +
	"Prononcu hundo kiel HUN-do, besto kiel BES-to, kaj estas kiel ES-tas. " +
	"Ne uzu anglan prononcon.";

/** Lesson text URLs are stable for a given text. */
export const lessonAudioUrlCache = new Map<string, string>();

/** Word audio URLs include server cache-busting versions, so cache by word text. */
export const wordAudioUrlCache = new Map<string, string>();

export async function ensureLessonAudioUrl(
	lessonId: string,
	text: string,
): Promise<string> {
	const cached = lessonAudioUrlCache.get(text);
	if (cached) return cached;
	const url = await fetchLessonAudioUrl(
		lessonId,
		text,
		ESPERANTO_PRONUNCIATION,
	);
	lessonAudioUrlCache.set(text, url);
	return url;
}

export async function ensureWordAudioUrl(word: string): Promise<string> {
	const cached = wordAudioUrlCache.get(word);
	if (cached) return cached;
	const url = await getWordAudioUrl(word);
	wordAudioUrlCache.set(word, url);
	return url;
}

type AudioCache = Map<string, string>;

export function useAudioPlayer() {
	const [playing, setPlaying] = useState<string | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	const stop = useCallback(() => {
		audioRef.current?.pause();
		audioRef.current = null;
	}, []);

	const playUrl = useCallback(
		(url: string, key: string | null = null) => {
			stop();
			setPlaying(key);
			const audio = new Audio(url);
			audioRef.current = audio;
			audio.addEventListener("ended", () => setPlaying(null));
			audio.addEventListener("error", () => setPlaying(null));
			audio.play().catch(() => setPlaying(null));
		},
		[stop],
	);

	useEffect(() => stop, [stop]);

	return { playing, playUrl, stop };
}

export function useCachedAudioPlayer(
	cache: AudioCache,
	ensureAudioUrl: (text: string) => Promise<string>,
) {
	const { playing, playUrl, stop } = useAudioPlayer();

	const play = useCallback(
		(text: string, key = text) => {
			const cached = cache.get(text);
			if (cached) {
				playUrl(cached, key);
				return;
			}
			ensureAudioUrl(text)
				.then((url) => playUrl(url, key))
				.catch(() => {});
		},
		[cache, ensureAudioUrl, playUrl],
	);

	return { playing, play, stop };
}

export function usePreparedAudio(
	texts: readonly string[],
	cache: AudioCache,
	ensureAudioUrl: (text: string) => Promise<string>,
	warningLabel: string,
): Set<string> {
	const [ready, setReady] = useState<Set<string>>(
		() => new Set(texts.filter((text) => cache.has(text))),
	);

	useEffect(() => {
		let cancelled = false;
		for (const text of texts) {
			if (cache.has(text)) continue;
			ensureAudioUrl(text)
				.then(() => {
					if (cancelled) return;
					setReady((prev) => new Set([...prev, text]));
				})
				.catch((err) => {
					console.warn(
						`Could not prefetch ${warningLabel} audio for:`,
						text,
						err,
					);
				});
		}
		return () => {
			cancelled = true;
		};
	}, [texts, cache, ensureAudioUrl, warningLabel]);

	return ready;
}

export function useWordAudio(texts: readonly string[]): Set<string> {
	return usePreparedAudio(texts, wordAudioUrlCache, ensureWordAudioUrl, "word");
}

export function useWordAudioPlayer() {
	return useCachedAudioPlayer(wordAudioUrlCache, ensureWordAudioUrl);
}

export function useLessonTextAudio(
	lessonId: string,
	texts: readonly string[],
): Set<string> {
	const ensureForLesson = useCallback(
		(text: string) => ensureLessonAudioUrl(lessonId, text),
		[lessonId],
	);
	return usePreparedAudio(
		texts,
		lessonAudioUrlCache,
		ensureForLesson,
		"lesson",
	);
}

export function useLessonTextAudioPlayer(lessonId: string) {
	const ensureForLesson = useCallback(
		(text: string) => ensureLessonAudioUrl(lessonId, text),
		[lessonId],
	);
	return useCachedAudioPlayer(lessonAudioUrlCache, ensureForLesson);
}
