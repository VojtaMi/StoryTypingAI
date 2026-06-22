import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { aiApi } from "./src/server/aiApi";
import { galleryApi } from "./src/server/galleryApi";
import {
	openingsApi,
	storyAudioApi,
	storyImagesApi,
} from "./src/server/openingsApi";
import { savesApi } from "./src/server/savesApi";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	return {
		plugins: [
			react(),
			savesApi(),
			storyImagesApi(),
			storyAudioApi(),
			galleryApi(),
			openingsApi(env.OPENAI_API_KEY, env.ANTHROPIC_API_KEY),
			aiApi(env.OPENAI_API_KEY, env.ANTHROPIC_API_KEY),
		],
	};
});
