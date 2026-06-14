import { defineConfig } from "vite";

export default defineConfig({
	build: {
		copyPublicDir: false,
		outDir: "dist-server",
		ssr: "src/server/production.ts",
	},
});
