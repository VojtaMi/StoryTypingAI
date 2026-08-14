import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type OpenAI from "openai";
import {
	loadAuthorInputs,
	parseStoryChainCliArgs,
} from "../scripts/simulate-story-chain.ts";
import { DEFAULT_TEXT_MODEL, reasoningEffortForModel } from "../src/models.ts";
import { completeAi } from "../src/server/aiService.ts";

const execFileAsync = promisify(execFile);

const defaults = parseStoryChainCliArgs([]);
assert.equal(defaults.genre, "scifi");
assert.equal(defaults.length, 5);
assert.equal(defaults.model, DEFAULT_TEXT_MODEL);
assert.equal(defaults.retries, 2);
assert.equal(reasoningEffortForModel(DEFAULT_TEXT_MODEL), "low");

const configured = parseStoryChainCliArgs([
	"--genre",
	"fantasy",
	"--seed",
	"glass forest",
	"--length",
	"3",
	"--retries",
	"0",
	"--model",
	"gpt-5.5",
	"--json",
]);
assert.equal(configured.genre, "fantasy");
assert.equal(configured.seed, "glass forest");
assert.equal(configured.length, 3);
assert.equal(configured.retries, 0);
assert.equal(configured.model, "gpt-5.5");
assert.equal(configured.json, true);

assert.throws(
	() => parseStoryChainCliArgs(["--genre", "romance"]),
	/Unknown genre/,
);
assert.throws(
	() => parseStoryChainCliArgs(["--model", "unknown-model"]),
	/Unknown model/,
);
assert.throws(
	() => parseStoryChainCliArgs(["--length", "0"]),
	/positive integer/,
);
assert.throws(
	() => parseStoryChainCliArgs(["--retries", "-1"]),
	/non-negative integer/,
);
console.log("checked story chain CLI: arguments and Luna Low default");

const completionRequests: unknown[] = [];
const fakeOpenAi = {
	chat: {
		completions: {
			create: async (request: unknown) => {
				completionRequests.push(request);
				return {
					choices: [
						{ finish_reason: "stop", message: { content: "A result." } },
					],
				};
			},
		},
	},
} as unknown as OpenAI;
await completeAi(
	fakeOpenAi,
	[{ role: "user", content: "Begin." }],
	400,
	"gpt-5.6-luna",
);
assert.equal(
	(completionRequests[0] as { reasoning_effort?: string }).reasoning_effort,
	"low",
);
console.log("checked story AI: Luna requests use low reasoning");

const temporaryDirectory = await mkdtemp(join(tmpdir(), "story-chain-test-"));
try {
	const validPath = join(temporaryDirectory, "valid.json");
	await writeFile(
		validPath,
		JSON.stringify(["Open the door.", "Run!"]),
		"utf8",
	);
	assert.deepEqual(await loadAuthorInputs(validPath), [
		"Open the door.",
		"Run!",
	]);

	const invalidPath = join(temporaryDirectory, "invalid.json");
	await writeFile(invalidPath, JSON.stringify(["valid", "  "]), "utf8");
	await assert.rejects(loadAuthorInputs(invalidPath), /non-empty strings/);
} finally {
	await rm(temporaryDirectory, { recursive: true });
}
console.log("checked story chain CLI: author input files are validated");

const { stdout, stderr } = await execFileAsync(
	process.execPath,
	["--import", "tsx", "scripts/simulate-story-chain.ts", "--help"],
	{ cwd: process.cwd() },
);
assert.match(stdout, /Usage: npm run story:chain/);
assert.match(stdout, /memory-compaction pipeline/);
assert.equal(stderr, "");
console.log("checked story chain CLI: help needs no provider credentials");

console.log("\nstory CLI checks passed");
