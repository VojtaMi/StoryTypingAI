import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
	createReadingStoryComplete,
	loadCliLearnerContext,
	parseReadingStoryCliArgs,
} from "../scripts/generate-reading-story.ts";
import { DEFAULT_LEARNER_CONTEXT } from "../src/learnerState.ts";
import { DEFAULT_TEXT_MODEL } from "../src/models.ts";

const execFileAsync = promisify(execFile);

const defaults = parseReadingStoryCliArgs([]);
assert.equal(defaults.model, DEFAULT_TEXT_MODEL);
assert.equal(defaults.defaultLearner, false);
assert.equal(defaults.learnerStatePath, undefined);
assert.equal(defaults.reasoningEffort, undefined);

const configured = parseReadingStoryCliArgs([
	"--model",
	"gpt-5.4",
	"--learner-state",
	"custom.json",
	"--reasoning",
	"medium",
]);
assert.equal(configured.model, "gpt-5.4");
assert.equal(configured.learnerStatePath, "custom.json");
assert.equal(configured.reasoningEffort, "medium");

assert.throws(
	() =>
		parseReadingStoryCliArgs([
			"--default-learner",
			"--learner-state",
			"custom.json",
		]),
	/cannot be used together/,
);
assert.throws(
	() => parseReadingStoryCliArgs(["--model", "unknown-model"]),
	/Unknown model/,
);
assert.throws(
	() => parseReadingStoryCliArgs(["--reasoning", "enormous"]),
	/Unknown reasoning effort/,
);
assert.throws(
	() =>
		parseReadingStoryCliArgs([
			"--model",
			"claude-sonnet-4-6",
			"--reasoning",
			"medium",
		]),
	/OpenAI GPT models/,
);
console.log("checked story CLI: arguments and defaults");

const temporaryDirectory = await mkdtemp(join(tmpdir(), "story-cli-test-"));
try {
	const validPath = join(temporaryDirectory, "valid.json");
	await writeFile(validPath, JSON.stringify(DEFAULT_LEARNER_CONTEXT), "utf8");
	assert.deepEqual(
		await loadCliLearnerContext({
			defaultLearner: false,
			learnerStatePath: validPath,
		}),
		DEFAULT_LEARNER_CONTEXT,
	);

	const invalidPath = join(temporaryDirectory, "invalid.json");
	await writeFile(invalidPath, JSON.stringify({ level: "beginner" }), "utf8");
	await assert.rejects(
		loadCliLearnerContext({
			defaultLearner: false,
			learnerStatePath: invalidPath,
		}),
		/current learner-state schema/,
	);
} finally {
	await rm(temporaryDirectory, { recursive: true });
}
console.log("checked story CLI: explicit learner state is validated");

const requestedEfforts: Array<string | undefined> = [];
const requestedModels: Array<string | undefined> = [];
const productionComplete = createReadingStoryComplete(async (request) => {
	requestedEfforts.push(request.reasoningEffort);
	requestedModels.push(request.model);
	return "{}";
});
await productionComplete([], 100, {
	model: "gpt-5.6-luna",
	reasoningEffort: "low",
});

const overriddenComplete = createReadingStoryComplete(async (request) => {
	requestedEfforts.push(request.reasoningEffort);
	return "{}";
}, "medium");
await overriddenComplete([], 100, { reasoningEffort: "low" });
assert.deepEqual(requestedEfforts, ["low", "medium"]);
assert.deepEqual(requestedModels, ["gpt-5.6-luna"]);
console.log(
	"checked story CLI: reasoning defaults and overrides are forwarded",
);

const { stdout, stderr } = await execFileAsync(
	process.execPath,
	["--import", "tsx", "scripts/generate-reading-story.ts", "--help"],
	{ cwd: process.cwd() },
);
assert.match(stdout, /Usage: npm run story:generate/);
assert.equal(stderr, "");
console.log("checked story CLI: help needs no provider credentials");

console.log("\nstory CLI checks passed");
