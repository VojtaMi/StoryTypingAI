import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
	bundledSavePath,
	bundleIdPattern,
	pathExists,
	storiesDir,
	storyBundlePath,
} from "./storyBundleStore";

const storyImagesDir = join(process.cwd(), "story-images");
const storyAudioDir = join(process.cwd(), "story-audio");

const savesDir = join(process.cwd(), "saves");

export const saveIdPattern = /^[a-zA-Z0-9_-]+$/;

export async function listSaves() {
	await mkdir(savesDir, { recursive: true });
	await mkdir(storiesDir, { recursive: true });
	const [legacyNames, bundleEntries] = await Promise.all([
		readdir(savesDir),
		readdir(storiesDir, { withFileTypes: true }),
	]);

	const ids = new Set<string>();
	for (const entry of bundleEntries) {
		if (entry.isDirectory()) ids.add(entry.name);
	}
	for (const name of legacyNames) {
		if (name.endsWith(".json")) ids.add(name.slice(0, -".json".length));
	}

	const saves = await Promise.all([...ids].map((id) => readSave(id)));

	return saves
		.filter((save) => save !== null)
		.map((save) => {
			const latestText =
				save.currentTarget ??
				save.segments.at(-1)?.text ??
				save.messages.at(-1)?.content ??
				"";
			return {
				id: save.id,
				genreId: save.genreId,
				title: save.title,
				updatedAt: save.updatedAt,
				preview: latestText.slice(0, 180),
				phase: save.phase,
				isReadingStory: Boolean(save.readingStory),
			};
		})
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function readSave(id: string) {
	try {
		const text = await readFile(await resolvedSavePath(id), "utf8");
		return JSON.parse(text);
	} catch {
		return null;
	}
}

export async function writeSave(id: string, save: unknown) {
	const path = await writeSavePath(id);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(save, null, 2)}\n`, "utf8");
}

export async function deleteSave(id: string) {
	await rm(savePath(id), { force: true });
	await rm(join(storyImagesDir, id), { recursive: true, force: true });
	await rm(join(storyAudioDir, id), { recursive: true, force: true });
	await rm(storyBundlePath(id), { recursive: true, force: true });
}

function savePath(id: string) {
	return join(savesDir, `${id}.json`);
}

async function resolvedSavePath(id: string) {
	const bundled = bundledSavePath(id);
	if (await pathExists(bundled)) return bundled;
	return savePath(id);
}

async function writeSavePath(id: string) {
	const legacy = savePath(id);
	if (!bundleIdPattern.test(id) && (await pathExists(legacy))) return legacy;
	return bundledSavePath(id);
}
