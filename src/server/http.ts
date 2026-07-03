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

export function sendBufferWithRangeSupport(
	req: IncomingMessage,
	res: ServerResponse,
	buffer: Buffer,
	contentType: string,
) {
	res.setHeader("Content-Type", contentType);
	res.setHeader("Accept-Ranges", "bytes");

	const range = req.headers.range;
	const match = typeof range === "string" && /^bytes=(\d*)-(\d*)$/.exec(range);
	if (!match) {
		res.statusCode = 200;
		res.setHeader("Content-Length", buffer.length);
		res.end(buffer);
		return;
	}

	const total = buffer.length;
	const start = match[1] ? Number(match[1]) : total - Number(match[2]);
	const end = match[2] && match[1] ? Number(match[2]) : total - 1;
	if (
		Number.isNaN(start) ||
		Number.isNaN(end) ||
		start > end ||
		start < 0 ||
		end >= total
	) {
		res.statusCode = 416;
		res.setHeader("Content-Range", `bytes */${total}`);
		res.end();
		return;
	}

	res.statusCode = 206;
	res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
	res.setHeader("Content-Length", end - start + 1);
	res.end(buffer.subarray(start, end + 1));
}

export function normalizeStoryText(text: string): string {
	return text
		.replace(/[‘’‚‛]/g, "'")
		.replace(/[“”„‟]/g, '"')
		.replace(/\*\*([^*\n]+)\*\*/g, "$1")
		.replace(/(^|[\s(["])\*([^*\n]+)\*(?=[\s.,;:!?")\]]|$)/g, "$1$2")
		.replace(/–/g, "-")
		.replace(/—/g, "--")
		.replace(/…/g, "...");
}
