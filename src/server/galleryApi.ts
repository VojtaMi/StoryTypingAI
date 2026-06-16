import type { Plugin } from "vite";
import { sendJson } from "./http";
import { listStoryImages } from "./openingsStore";
import { saveIdPattern } from "./savesStore";

export function galleryApi(): Plugin {
	return {
		name: "gallery-api",
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				if (!req.url?.startsWith("/api/gallery/") || req.method !== "GET") {
					next();
					return;
				}

				try {
					const url = new URL(req.url, "http://localhost");
					const parts = url.pathname.split("/").filter(Boolean);
					const storyId = parts[2] ? decodeURIComponent(parts[2]) : undefined;

					if (!storyId || !saveIdPattern.test(storyId)) {
						sendJson(res, 404, { error: "Story not found." });
						return;
					}

					sendJson(res, 200, await listStoryImages(storyId));
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					sendJson(res, 500, { error: message });
				}
			});
		},
	};
}
