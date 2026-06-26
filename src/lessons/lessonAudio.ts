import { fetchLessonAudioUrl } from "../ai";

export const ESPERANTO_PRONUNCIATION =
	"Legu la tekston kiel klara, natura Esperanto por komencanto. " +
	"Parolu malrapide kaj klare. " +
	"Ĉiu litero estas prononcata; ne ekzistas silentaj literoj. " +
	"La vokaloj estas puraj kaj mallongaj: a, e, i, o, u. " +
	"La akcento ĉiam estas sur la antaŭlasta silabo. " +
	"Prononcu hundo kiel HUN-do, besto kiel BES-to, kaj estas kiel ES-tas. " +
	"Ne uzu anglan prononcon.";

/** Module-level URL cache — server URLs are stable, no revocation needed. */
export const audioUrlCache = new Map<string, string>();

export async function ensureLessonAudioUrl(
	lessonId: string,
	text: string,
): Promise<string> {
	const cached = audioUrlCache.get(text);
	if (cached) return cached;
	const url = await fetchLessonAudioUrl(
		lessonId,
		text,
		ESPERANTO_PRONUNCIATION,
	);
	audioUrlCache.set(text, url);
	return url;
}
