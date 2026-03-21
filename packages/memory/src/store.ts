import { neo4jClient } from "@luna/knowledge";
import type { Memory, MemoryTier } from "./types.ts";

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

export async function storeMemory(memory: Memory): Promise<void> {
	if (!memory.expiresAt) {
		memory.expiresAt = computeExpiresAt(memory.tier, memory.createdAt);
	}

	const query = `
		MERGE (m:Memory {id: $id})
		SET m.content = $content,
			m.tier = $tier,
			m.importance = $importance,
			m.tags = $tags,
			m.source = $source,
			m.createdAt = $createdAt,
			m.lastAccessedAt = $lastAccessedAt,
			m.accessCount = $accessCount,
			m.expiresAt = $expiresAt
	`;

	const driver = neo4jClient();
	const session = driver.session();
	try {
		await session.executeWrite((tx) => tx.run(query, memory));
	} finally {
		await session.close();
	}
}

export async function storeMemories(newMemories: Memory[]): Promise<void> {
	for (const m of newMemories) {
		await storeMemory(m);
	}
}

export async function getMemory(id: string): Promise<Memory | undefined> {
	await cleanExpiredMemories();

	const query = `
		MATCH (m:Memory {id: $id})
		SET m.lastAccessedAt = toString(datetime()), m.accessCount = m.accessCount + 1
		RETURN m
	`;

	const driver = neo4jClient();
	const session = driver.session();
	try {
		const result = await session.executeWrite((tx) => tx.run(query, { id }));
		if (result.records.length === 0) return undefined;
		return result.records[0]?.get("m").properties as Memory | undefined;
	} finally {
		await session.close();
	}
}

export async function getMemoriesByTier(tier: MemoryTier): Promise<Memory[]> {
	await cleanExpiredMemories();

	const query = `MATCH (m:Memory {tier: $tier}) RETURN m`;
	const driver = neo4jClient();
	const session = driver.session();
	try {
		const result = await session.executeRead((tx) => tx.run(query, { tier }));
		return result.records.map((r) => r.get("m").properties as Memory);
	} finally {
		await session.close();
	}
}

export async function getMemoriesByTag(tag: string): Promise<Memory[]> {
	await cleanExpiredMemories();

	const query = `MATCH (m:Memory) WHERE $tag IN m.tags RETURN m`;
	const driver = neo4jClient();
	const session = driver.session();
	try {
		const result = await session.executeRead((tx) => tx.run(query, { tag }));
		return result.records.map((r) => r.get("m").properties as Memory);
	} finally {
		await session.close();
	}
}

export async function getAllMemories(): Promise<Memory[]> {
	await cleanExpiredMemories();

	const query = `MATCH (m:Memory) RETURN m`;
	const driver = neo4jClient();
	const session = driver.session();
	try {
		const result = await session.executeRead((tx) => tx.run(query));
		return result.records.map((r) => r.get("m").properties as Memory);
	} finally {
		await session.close();
	}
}

export async function deleteMemory(id: string): Promise<boolean> {
	const query = `
		MATCH (m:Memory {id: $id})
		WITH m, m IS NOT NULL AS exists
		DETACH DELETE m
		RETURN exists
	`;
	const driver = neo4jClient();
	const session = driver.session();
	try {
		const result = await session.executeWrite((tx) => tx.run(query, { id }));
		return result.records.length > 0 && !!result.records[0]?.get("exists");
	} finally {
		await session.close();
	}
}

export async function cleanExpiredMemories(): Promise<number> {
	const query = `
		MATCH (m:Memory)
		WHERE m.expiresAt IS NOT NULL AND datetime(m.expiresAt) < datetime()
		WITH m
		DETACH DELETE m
		RETURN count(m) as deleted
	`;
	const driver = neo4jClient();
	const session = driver.session();
	try {
		const result = await session.executeWrite((tx) => tx.run(query));
		return result.records.length > 0 ? Number(result.records[0]?.get("deleted") ?? 0) : 0;
	} finally {
		await session.close();
	}
}

export async function consolidateMemories(): Promise<Memory[]> {
	const all = await getAllMemories();
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

			await storeMemory(mem);

			for (const dup of duplicates) {
				await deleteMemory(dup.id);
			}
		}

		consolidated.push(mem);
	}

	return consolidated;
}

export async function promoteOldMemories(): Promise<void> {
	const now = Date.now();
	const oneDay = 24 * 60 * 60 * 1000;
	const oneWeek = 7 * oneDay;

	const all = await getAllMemories();

	for (const mem of all) {
		const age = now - new Date(mem.createdAt).getTime();
		let changed = false;

		if (mem.tier === "working" && age > oneDay && mem.accessCount >= 2) {
			mem.tier = "short_term";
			mem.expiresAt = computeExpiresAt("short_term", mem.createdAt);
			changed = true;
		}
		if (mem.tier === "short_term" && age > oneWeek && mem.accessCount >= 5) {
			mem.tier = "long_term";
			mem.expiresAt = computeExpiresAt("long_term", mem.createdAt);
			changed = true;
		}

		if (changed) {
			await storeMemory(mem);
		}
	}
}

export async function decayLowValueMemories(threshold = 0.1): Promise<number> {
	const now = Date.now();
	let deleted = 0;

	const all = await getAllMemories();

	for (const mem of all) {
		const daysSinceAccess = (now - new Date(mem.lastAccessedAt).getTime()) / (24 * 60 * 60 * 1000);
		const effectiveImportance = mem.importance * 0.95 ** daysSinceAccess;

		if (effectiveImportance < threshold && mem.tier === "working") {
			await deleteMemory(mem.id);
			deleted++;
		}
	}

	return deleted;
}
