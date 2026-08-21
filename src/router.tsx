import {
	createRootRoute,
	createRoute,
	createRouter,
} from "@tanstack/react-router";
import App from "./App";

const rootRoute = createRootRoute({ component: App });
const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
});
const languageRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "$language",
});
const storyRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "$language/story/$storyId",
});

const routeTree = rootRoute.addChildren([
	indexRoute,
	languageRoute,
	storyRoute,
]);

export const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	scrollRestoration: true,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
