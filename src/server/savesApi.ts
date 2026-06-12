import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Plugin } from "vite";
import { readBody, sendJson } from "./http";

const savesDir = join(process.cwd(), "saves");
const saveIdPattern = /^[a-zA-Z0-9_-]+$/;

export function savesApi(): Plugin {
	return {
		name: "local-json-saves-api",
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				if (!req.url?.startsWith("/api/saves")) {
					next();
					return;
				}

				try {
					const url = new URL(req.url, "http://localhost");
					const parts = url.pathname.split("/").filter(Boolean);
					const id = parts[2];

					if (parts.length === 2 && req.method === "GET") {
						const saves = await listSaves();
						sendJson(res, 200, saves);
						return;
					}

					if (parts.length !== 3 || !id || !saveIdPattern.test(id)) {
						sendJson(res, 404, { error: "Save not found." });
						return;
					}

					if (req.method === "GET") {
						const save = await readSave(id);
						if (!save) {
							sendJson(res, 404, { error: "Save not found." });
							return;
						}
						sendJson(res, 200, save);
						return;
					}

					if (req.method === "PUT") {
						const save = JSON.parse(await readBody(req));
						if (save.id !== id) {
							sendJson(res, 400, { error: "Save id does not match URL." });
							return;
						}
						await writeSave(id, save);
						sendJson(res, 200, save);
						return;
					}

					if (req.method === "DELETE") {
						await deleteSave(id);
						sendJson(res, 204, null);
						return;
					}

					sendJson(res, 405, { error: "Method not allowed." });
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					sendJson(res, 500, { error: message });
				}
			});
		},
	};
}

async function listSaves() {
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

async function readSave(id: string) {
	try {
		const text = await readFile(savePath(id), "utf8");
		return JSON.parse(text);
	} catch {
		return null;
	}
}

async function writeSave(id: string, save: unknown) {
	await mkdir(savesDir, { recursive: true });
	await writeFile(savePath(id), `${JSON.stringify(save, null, 2)}\n`, "utf8");
}

async function deleteSave(id: string) {
	await rm(savePath(id), { force: true });
}

function savePath(id: string) {
	return join(savesDir, `${id}.json`);
}
