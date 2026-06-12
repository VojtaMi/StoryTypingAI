import type { IncomingMessage, ServerResponse } from "node:http";

export async function readBody(req: IncomingMessage) {
	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString("utf8");
}

export function sendJson(
	res: ServerResponse,
	statusCode: number,
	body: unknown,
) {
	res.statusCode = statusCode;
	if (body === null && statusCode === 204) {
		res.end();
		return;
	}
	res.setHeader("Content-Type", "application/json");
	res.end(JSON.stringify(body));
}

export function normalizeStoryText(text: string): string {
	return text
		.replace(/[''‚‛]/g, "'")
		.replace(/[""„‟]/g, '"')
		.replace(/–/g, "-")
		.replace(/—/g, "--")
		.replace(/…/g, "...");
}
