import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const savesDir = join(process.cwd(), "saves");

export const saveIdPattern = /^[a-zA-Z0-9_-]+$/;

export async function listSaves() {
	await mkdir(savesDir, { recursive: true });
	const names = await readdir(savesDir);
	const saves = await Promise.all(
		names
			.filter((name) => name.endsWith(".json"))
			.map(async (name) => {
				const id = name.slice(0, -".json".length);
				return readSave(id);
			}),
	);

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
			};
		})
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function readSave(id: string) {
	try {
		const text = await readFile(savePath(id), "utf8");
		return JSON.parse(text);
	} catch {
		return null;
	}
}

export async function writeSave(id: string, save: unknown) {
	await mkdir(savesDir, { recursive: true });
	await writeFile(savePath(id), `${JSON.stringify(save, null, 2)}\n`, "utf8");
}

export async function deleteSave(id: string) {
	await rm(savePath(id), { force: true });
}

function savePath(id: string) {
	return join(savesDir, `${id}.json`);
}
