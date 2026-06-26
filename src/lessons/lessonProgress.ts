const STORAGE_KEY = "esperanto.lessonProgress.v1";

export interface LessonProgress {
	lastPath: string;
	completedStages: string[];
}

const DEFAULT_PROGRESS: LessonProgress = {
	lastPath: "/lessons/intro",
	completedStages: [],
};

function isLessonProgress(value: unknown): value is LessonProgress {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Partial<LessonProgress>;
	return (
		typeof candidate.lastPath === "string" &&
		Array.isArray(candidate.completedStages) &&
		candidate.completedStages.every((stage) => typeof stage === "string")
	);
}

export function readLessonProgress(): LessonProgress {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT_PROGRESS;
		const parsed = JSON.parse(raw);
		if (!isLessonProgress(parsed)) return DEFAULT_PROGRESS;
		return parsed;
	} catch {
		return DEFAULT_PROGRESS;
	}
}

export function saveLessonProgress(progress: LessonProgress) {
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function rememberLessonPath(path: string) {
	const progress = readLessonProgress();
	saveLessonProgress({ ...progress, lastPath: path });
}

export function completeLessonStage(stageId: string, nextPath: string) {
	const progress = readLessonProgress();
	const completedStages = new Set(progress.completedStages);
	completedStages.add(stageId);
	saveLessonProgress({
		lastPath: nextPath,
		completedStages: [...completedStages],
	});
}
