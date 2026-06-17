import type { ServerResponse } from "node:http";

export function startNdjsonResponse(res: ServerResponse) {
	res.statusCode = 200;
	res.setHeader("Content-Type", "application/x-ndjson");
	res.setHeader("Cache-Control", "no-cache");
}

export function writeJsonLine(res: NodeJS.WritableStream, body: unknown) {
	res.write(`${JSON.stringify(body)}\n`);
}

export function sendNdjsonError(res: ServerResponse, message: string) {
	if (!res.headersSent) {
		startNdjsonResponse(res);
	}
	writeJsonLine(res, { type: "error", error: message });
	res.end();
}
