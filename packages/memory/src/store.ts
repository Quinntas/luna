import type { Memory, MemoryTier } from "./types.ts";

const memories = new Map<string, Memory>();

export const TIER_TTL: Record<MemoryTier, number | null> = {
	working: 24 * 60 * 60 * 1000,
	short_term: 7 * 24 * 60 * 60 * 1000,
	long_term: null,
};

function computeExpiresAt(tier: MemoryTier, createdAt: string): string | null {
	const ttl = TIER_TTL[tier];
	if (ttl === null) return null;
	return new Date(new Date(createdAt).getTime() + ttl).toISOString();
}

export function storeMemory(memory: Memory): void {
	if (!memory.expiresAt) {
		memory.expiresAt = computeExpiresAt(memory.tier, memory.createdAt);
	}
	memories.set(memory.id, memory);
}

export function storeMemories(newMemories: Memory[]): void {
	for (const m of newMemories) {
		storeMemory(m);
	}
}

export function getMemory(id: string): Memory | undefined {
	const mem = memories.get(id);
	if (!mem) return undefined;
	if (mem.expiresAt && new Date(mem.expiresAt) < new Date()) {
		memories.delete(id);
		return undefined;
	}
	mem.lastAccessedAt = new Date().toISOString();
	mem.accessCount++;
	return mem;
}

export function getMemoriesByTier(tier: MemoryTier): Memory[] {
	cleanExpiredMemories();
	return [...memories.values()].filter((m) => m.tier === tier);
}

export function getMemoriesByTag(tag: string): Memory[] {
	cleanExpiredMemories();
	return [...memories.values()].filter((m) => m.tags.includes(tag));
}

export function getAllMemories(): Memory[] {
	cleanExpiredMemories();
	return [...memories.values()];
}

export function deleteMemory(id: string): boolean {
	return memories.delete(id);
}

export function cleanExpiredMemories(): number {
	const now = new Date();
	let deleted = 0;
	for (const [id, mem] of memories) {
		if (mem.expiresAt && new Date(mem.expiresAt) < now) {
			memories.delete(id);
			deleted++;
		}
	}
	return deleted;
}

export function consolidateMemories(): Memory[] {
	const all = getAllMemories();
	const consolidated: Memory[] = [];
	const seen = new Set<string>();

	for (const mem of all) {
		const key = mem.content.toLowerCase().slice(0, 100);
		if (seen.has(key)) continue;
		seen.add(key);

		const duplicates = all.filter(
			(m) => m.id !== mem.id && m.content.toLowerCase().slice(0, 100) === key,
		);

		if (duplicates.length > 0) {
			const allVersions = [mem, ...duplicates];
			const highestImportance = Math.max(...allVersions.map((m) => m.importance));
			const mergedTags = [...new Set(allVersions.flatMap((m) => m.tags))];

			mem.importance = highestImportance;
			mem.tags = mergedTags;
			mem.accessCount = allVersions.reduce((sum, m) => sum + m.accessCount, 0);

			for (const dup of duplicates) {
				memories.delete(dup.id);
			}
		}

		consolidated.push(mem);
	}

	return consolidated;
}

export function promoteOldMemories(): void {
	const now = Date.now();
	const oneDay = 24 * 60 * 60 * 1000;
	const oneWeek = 7 * oneDay;

	for (const mem of memories.values()) {
		const age = now - new Date(mem.createdAt).getTime();

		if (mem.tier === "working" && age > oneDay && mem.accessCount >= 2) {
			mem.tier = "short_term";
		}
		if (mem.tier === "short_term" && age > oneWeek && mem.accessCount >= 5) {
			mem.tier = "long_term";
		}
	}
}

export function decayLowValueMemories(threshold = 0.1): number {
	const now = Date.now();
	let deleted = 0;

	for (const [id, mem] of memories) {
		const daysSinceAccess = (now - new Date(mem.lastAccessedAt).getTime()) / (24 * 60 * 60 * 1000);
		const effectiveImportance = mem.importance * 0.95 ** daysSinceAccess;

		if (effectiveImportance < threshold && mem.tier === "working") {
			memories.delete(id);
			deleted++;
		}
	}

	return deleted;
}
