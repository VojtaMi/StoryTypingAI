import { access } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { genres, getGenre, isGenreId } from "../src/genres.ts";
import {
	bundleIdPattern,
	createBundleId,
	storyLanguage,
} from "../src/server/storyBundleStore.ts";

const requestedIds = process.argv
	.slice(2)
	.filter((argument) => argument !== "--");
const errors: string[] = [];
const publicDir = resolve(process.cwd(), "public");

if (requestedIds.includes("--help")) {
	process.stdout.write(`Usage: npm run language:validate -- [language-id ...]

Validate every registered language, or only the named languages. This checks
registry fields, uniqueness, public assets, and language-specific story IDs.
It does not call an AI provider or assess the quality of language guidance.
`);
	process.exit(0);
}

const languages = requestedIds.length
	? requestedIds.flatMap((id) => {
			if (!isGenreId(id)) {
				errors.push(`Language "${id}" is not registered in src/genres.ts.`);
				return [];
			}
			return [getGenre(id)];
		})
	: genres;

for (const field of [
	"id",
	"label",
	"shortCode",
	"heroImageUrl",
	"botImageUrl",
	"faviconUrl",
] as const) {
	const duplicates = duplicateValues(genres.map((language) => language[field]));
	for (const value of duplicates) {
		errors.push(`${field} must be unique; "${value}" is used more than once.`);
	}
}

for (const language of languages) {
	const prefix = `[${language.id}]`;
	if (!/^[a-z][a-z0-9-]*$/.test(language.id)) {
		errors.push(`${prefix} id must be a lowercase ASCII slug.`);
	}
	if (!/^[A-Z]{2,4}$/.test(language.shortCode)) {
		errors.push(
			`${prefix} shortCode must contain 2–4 uppercase ASCII letters.`,
		);
	}

	for (const field of [
		"label",
		"systemPrompt",
		"botTeachingTopics",
		"beginnerLanguageGuidance",
		"grammarRequirements",
		"recapTitle",
		"recapAnswerExample",
		"ttsInstructions",
	] as const) {
		if (!language[field].trim()) errors.push(`${prefix} ${field} is empty.`);
	}

	if (!language.starterBrief.language.focus.trim()) {
		errors.push(`${prefix} starterBrief.language.focus is empty.`);
	}
	if (!language.starterBrief.language.calibrationSnippets.length) {
		errors.push(
			`${prefix} starterBrief.language.calibrationSnippets needs an example.`,
		);
	}
	for (const snippet of language.starterBrief.language.calibrationSnippets) {
		if (!snippet.trim())
			errors.push(`${prefix} has an empty calibration snippet.`);
	}

	await validateAsset(language.id, "heroImageUrl", language.heroImageUrl);
	await validateAsset(language.id, "botImageUrl", language.botImageUrl);
	await validateAsset(language.id, "faviconUrl", language.faviconUrl);

	const bundleId = createBundleId(language.id, "Validation story", "ABCDEF12");
	if (!bundleIdPattern.test(bundleId)) {
		errors.push(`${prefix} generated story id is rejected: ${bundleId}`);
	} else if (storyLanguage(bundleId) !== language.id) {
		errors.push(`${prefix} generated story id resolves to the wrong language.`);
	}
}

if (errors.length) {
	process.stderr.write(
		`Language validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}\n`,
	);
	process.exitCode = 1;
} else {
	process.stdout.write(
		`Validated ${languages.length} language${languages.length === 1 ? "" : "s"}: ${languages.map(({ id }) => id).join(", ")}\n`,
	);
}

async function validateAsset(
	languageId: string,
	field: "heroImageUrl" | "botImageUrl" | "faviconUrl",
	url: string,
) {
	const pathname = url.split("?", 1)[0];
	if (!pathname.startsWith("/")) {
		errors.push(`[${languageId}] ${field} must be a root-relative public URL.`);
		return;
	}
	const path = resolve(publicDir, pathname.slice(1));
	if (!path.startsWith(`${publicDir}${sep}`)) {
		errors.push(`[${languageId}] ${field} escapes the public directory.`);
		return;
	}
	try {
		await access(path);
	} catch {
		errors.push(`[${languageId}] ${field} does not exist: ${pathname}`);
	}
}

function duplicateValues(values: string[]): string[] {
	return [
		...new Set(
			values.filter((value, index) => values.indexOf(value) !== index),
		),
	];
}
