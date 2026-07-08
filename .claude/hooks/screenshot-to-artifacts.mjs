#!/usr/bin/env node
/**
 * PreToolUse hook for mcp__playwright__browser_take_screenshot.
 *
 * A relative `filename` resolves against the process CWD — the repo root — not
 * the Playwright MCP `--output-dir`. That silently drops PNGs into the repo.
 *
 * Rather than block the call, rewrite it: any relative filename is redirected
 * into `.artifacts/screenshots/`, which is gitignored. Absolute paths pass
 * through untouched. A relative path that escapes the repo is denied.
 *
 * Reads the hook payload on stdin, writes hook JSON on stdout.
 */
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const artifactDir = resolve(projectDir, ".artifacts/screenshots");

const payload = JSON.parse((await readStdin()) || "{}");
const toolInput = payload.tool_input ?? {};
const filename = toolInput.filename;

// No filename: the MCP server already writes into its --output-dir.
// Absolute filename: the caller chose a location deliberately.
if (!filename || isAbsolute(filename)) process.exit(0);

const target = resolve(artifactDir, filename);
if (target !== artifactDir && !target.startsWith(artifactDir + sep)) {
	emit({
		permissionDecision: "deny",
		permissionDecisionReason: `Screenshot filename "${filename}" escapes ${artifactDir}. Pass a plain name, or an absolute path.`,
	});
	process.exit(0);
}

mkdirSync(dirname(target), { recursive: true });
emit({
	updatedInput: { ...toolInput, filename: target },
	permissionDecisionReason: `Redirected relative screenshot filename into ${artifactDir} (gitignored) so it cannot land in the repo root.`,
});

function emit(hookSpecificOutput) {
	process.stdout.write(
		JSON.stringify({
			hookSpecificOutput: {
				hookEventName: "PreToolUse",
				...hookSpecificOutput,
			},
		}),
	);
}

async function readStdin() {
	let text = "";
	process.stdin.setEncoding("utf8");
	for await (const chunk of process.stdin) text += chunk;
	return text;
}
