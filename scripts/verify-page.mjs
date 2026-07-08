/**
 * Renders a page in a real browser and fails if it did not render cleanly.
 *
 * Exists so an implementing agent can verify its own UI work. Codex cannot use
 * Playwright through MCP (`codex exec` auto-cancels MCP tool calls), but it can
 * run this script — see the "Delegating Implementation to Codex" section of
 * CLAUDE.md.
 *
 *   node scripts/verify-page.mjs <url> [--expect-text "..."] [--shot name.png]
 *
 * Exits non-zero on: navigation failure, any console error, any uncaught page
 * error, any failed request, or a missing --expect-text.
 */
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ARTIFACT_DIR = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../.artifacts/verify",
);

const args = process.argv.slice(2);
const url = args.find((arg) => !arg.startsWith("--"));
if (!url) {
	console.error(
		'Usage: node scripts/verify-page.mjs <url> [--expect-text "..."] [--shot name.png]',
	);
	process.exit(2);
}
const expectText = readArg("--expect-text");
const shotName = readArg("--shot") ?? "page.png";

await mkdir(ARTIFACT_DIR, { recursive: true });

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];

const browser = await chromium.launch();
const page = await browser.newPage();

page.on("console", (message) => {
	if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("requestfailed", (request) => {
	failedRequests.push(`${request.method()} ${request.url()}`);
});

let navigationError;
try {
	const response = await page.goto(url, { waitUntil: "networkidle" });
	if (!response?.ok()) {
		navigationError = `HTTP ${response?.status() ?? "no response"}`;
	}
} catch (error) {
	navigationError = String(error);
}

const title = navigationError ? null : await page.title();
const shotPath = resolve(ARTIFACT_DIR, shotName);
if (!navigationError) await page.screenshot({ path: shotPath, fullPage: true });

const missingText =
	!navigationError && expectText
		? (await page.content()).includes(expectText)
			? null
			: expectText
		: null;

await browser.close();

const problems = [
	navigationError && `navigation: ${navigationError}`,
	missingText && `expected text not found: ${JSON.stringify(missingText)}`,
	...consoleErrors.map((text) => `console error: ${text}`),
	...pageErrors.map((text) => `page error: ${text}`),
	...failedRequests.map((text) => `failed request: ${text}`),
].filter(Boolean);

if (problems.length > 0) {
	console.error(`FAIL ${url}`);
	for (const problem of problems) console.error(`  - ${problem}`);
	process.exit(1);
}

console.log(`OK ${url}`);
console.log(`  title: ${title}`);
console.log(`  screenshot: ${shotPath}`);

function readArg(name) {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
}
