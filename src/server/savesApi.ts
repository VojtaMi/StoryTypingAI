import type { Plugin } from "vite";
import { readBody, sendJson } from "./http";
import {
	deleteSave,
	listSaves,
	readSave,
	saveIdPattern,
	writeSave,
} from "./savesStore";

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
