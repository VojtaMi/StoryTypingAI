import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const cacheFile = join(process.cwd(), "translation-cache.json");

async function readCache(): Promise<Record<string, string>> {
	try {
		return JSON.parse(await readFile(cacheFile, "utf8"));
	} catch {
		return {};
	}
}

async function writeCache(cache: Record<string, string>): Promise<void> {
	await writeFile(cacheFile, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

export async function lookupWords(
	words: string[],
): Promise<{ hits: Record<string, string>; misses: string[] }> {
	const cache = await readCache();
	const hits: Record<string, string> = {};
	const misses: string[] = [];
	for (const word of words) {
		if (word in cache) {
			hits[word] = cache[word];
		} else {
			misses.push(word);
		}
	}
	return { hits, misses };
}

export async function storeTranslations(
	translations: Record<string, string>,
): Promise<void> {
	const cache = await readCache();
	Object.assign(cache, translations);
	await writeCache(cache);
}

export async function evictWord(word: string): Promise<void> {
	const cache = await readCache();
	delete cache[word];
	await writeCache(cache);
}
