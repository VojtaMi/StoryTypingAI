export async function listStoryImages(storyId: string): Promise<string[]> {
	const res = await fetch(`/api/gallery/${encodeURIComponent(storyId)}`);
	if (!res.ok) return [];
	return res.json() as Promise<string[]>;
}
