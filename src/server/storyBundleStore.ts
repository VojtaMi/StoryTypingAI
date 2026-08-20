import { access } from "node:fs/promises";
import { join } from "node:path";
import { type GenreId, isGenreId } from "../genres";

export const storiesDir = join(process.cwd(), "stories");

export const bundleIdPattern =
	/^(esperanto|german|spanish)--[a-z0-9]+(?:-[a-z0-9]+)*--[a-z0-9]+$/;

export function createBundleId(genreId: GenreId, label: string, id: string) {
	const slug = slugify(label) || "story";
	return `${genreId}--${slug}--${id.slice(0, 8).toLowerCase()}`;
}

export function slugify(value: string) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

export function storyBundlePath(storyId: string) {
	return join(storiesDir, storyLanguage(storyId), storyId);
}

export function storyLanguage(storyId: string): GenreId {
	const language = storyId.split("--", 1)[0];
	if (!isGenreId(language)) {
		throw new Error(`Story id does not contain a valid language: ${storyId}`);
	}
	return language;
}

export function bundledSavePath(storyId: string) {
	return join(storyBundlePath(storyId), "story.json");
}

export function bundledFinishEvidencePath(storyId: string) {
	return join(storyBundlePath(storyId), "finish-evidence.json");
}

export function bundledAudioPath(storyId: string, filename: string) {
	return join(storyBundlePath(storyId), "audio", filename);
}

export function bundledImagesPath(storyId: string, filename: string) {
	return join(storyBundlePath(storyId), "images", filename);
}

export async function pathExists(path: string) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}
