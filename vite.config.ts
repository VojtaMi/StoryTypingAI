import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const brickGalleryRoutePattern = /^\/bricks(?:\/.*)?$/;

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		{
			name: "brick-gallery-routes",
			configureServer(server) {
				server.middlewares.use((req, _res, next) => {
					if (!req.url) {
						next();
						return;
					}

					const path = new URL(req.url, "http://localhost").pathname;
					if (brickGalleryRoutePattern.test(path)) {
						req.url = "/bricks.html";
					}

					next();
				});
			},
		},
	],
	server: {
		proxy: {
			"/api": "http://localhost:3001",
		},
	},
});
