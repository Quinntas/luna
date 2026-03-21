import { getAllMemories } from "./store.ts";
import type { Memory } from "./types.ts";

export async function retrieveRelevant(query: string, limit = 10): Promise<Memory[]> {
	const all = await getAllMemories();
	const queryLower = query.toLowerCase();
	const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

	const scored = all.map((mem) => {
		const contentLower = mem.content.toLowerCase();
		let score = 0;

		for (const term of queryTerms) {
			if (contentLower.includes(term)) score += 1;
		}

		for (const tag of mem.tags) {
			if (queryLower.includes(tag.toLowerCase())) score += 0.5;
		}

		score *= mem.importance;

		const daysSinceAccess =
			(Date.now() - new Date(mem.lastAccessedAt).getTime()) / (24 * 60 * 60 * 1000);
		score *= 0.98 ** daysSinceAccess;

		return { mem, score };
	});

	return scored
		.filter((s) => s.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map((s) => {
			s.mem.lastAccessedAt = new Date().toISOString();
			s.mem.accessCount++;
			return s.mem;
		});
}

export function formatMemoriesForContext(memories: Memory[]): string {
	if (memories.length === 0) return "";

	const grouped = {
		long_term: memories.filter((m) => m.tier === "long_term"),
		short_term: memories.filter((m) => m.tier === "short_term"),
		working: memories.filter((m) => m.tier === "working"),
	};

	let context = "";

	if (grouped.long_term.length > 0) {
		context += "Long-term memories:\n";
		context += grouped.long_term.map((m) => `- ${m.content}`).join("\n");
		context += "\n\n";
	}

	if (grouped.short_term.length > 0) {
		context += "Short-term memories:\n";
		context += grouped.short_term.map((m) => `- ${m.content}`).join("\n");
		context += "\n\n";
	}

	if (grouped.working.length > 0) {
		context += "Recent context:\n";
		context += grouped.working.map((m) => `- ${m.content}`).join("\n");
	}

	return context.trim();
}
