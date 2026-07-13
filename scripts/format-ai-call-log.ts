import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type AiCallRecord = {
	timestamp?: string;
	pathname?: string;
	kind?: string;
	provider?: string;
	model?: string;
	durationMs?: number;
	ok?: boolean;
	error?: {
		message?: string;
	};
	[key: string]: unknown;
};

const sourcePath = join(process.cwd(), "logs", "ai-calls.ndjson");
const prettyPath = join(process.cwd(), ".artifacts", "ai-calls.pretty.json");

async function readRecords(): Promise<AiCallRecord[]> {
	const contents = await readFile(sourcePath, "utf8");
	const records: AiCallRecord[] = [];

	for (const [index, line] of contents.split("\n").entries()) {
		if (!line.trim()) continue;
		try {
			const value: unknown = JSON.parse(line);
			if (!value || typeof value !== "object" || Array.isArray(value)) {
				throw new Error("record is not a JSON object");
			}
			records.push(value as AiCallRecord);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Could not parse ${sourcePath}:${index + 1}: ${message}`);
		}
	}

	return records;
}

function text(value: unknown, fallback = "-") {
	return typeof value === "string" && value ? value : fallback;
}

function number(value: unknown) {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clipped(value: unknown, width: number) {
	const string = text(value);
	return string.length <= width
		? string.padEnd(width)
		: `${string.slice(0, width - 1)}…`;
}

function printSummary(records: AiCallRecord[]) {
	if (records.length === 0) {
		console.log(`No AI calls found in ${sourcePath}.`);
		return;
	}

	console.log(
		[
			"TIME".padEnd(8),
			"STATUS".padEnd(6),
			"DURATION".padStart(9),
			"MODEL".padEnd(18),
			"KIND".padEnd(18),
			"ENDPOINT",
		].join("  "),
	);

	for (const record of records) {
		const time = record.timestamp?.slice(11, 19) ?? "-";
		const status = record.ok ? "OK" : "ERROR";
		const duration = `${number(record.durationMs).toLocaleString()} ms`;
		console.log(
			[
				time.padEnd(8),
				status.padEnd(6),
				duration.padStart(9),
				clipped(record.model, 18),
				clipped(record.kind, 18),
				text(record.pathname),
			].join("  "),
		);
		if (!record.ok && record.error?.message) {
			console.log(`         ↳ ${record.error.message}`);
		}
	}

	const failures = records.filter((record) => !record.ok).length;
	const totalDuration = records.reduce(
		(total, record) => total + number(record.durationMs),
		0,
	);
	const slowest = records.reduce((current, record) =>
		number(record.durationMs) > number(current.durationMs) ? record : current,
	);

	console.log("");
	console.log(
		`${records.length} calls · ${failures} failures · ${Math.round(totalDuration / records.length).toLocaleString()} ms average`,
	);
	console.log(
		`Slowest: ${number(slowest.durationMs).toLocaleString()} ms · ${text(slowest.kind)} · ${text(slowest.pathname)}`,
	);
}

async function writePrettyLog(records: AiCallRecord[]) {
	await mkdir(dirname(prettyPath), { recursive: true });
	await writeFile(
		prettyPath,
		`${JSON.stringify(records, null, "\t")}\n`,
		"utf8",
	);
	console.log(`Wrote ${records.length} AI calls to ${prettyPath}`);
}

async function main() {
	const command = process.argv[2];
	if (command !== "summary" && command !== "pretty") {
		throw new Error("Usage: format-ai-call-log.ts <summary|pretty>");
	}

	const records = await readRecords();
	if (command === "summary") printSummary(records);
	else await writePrettyLog(records);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
