import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { neo4jClient } from "@luna/knowledge";
import { formatMemoriesForContext, retrieveRelevant } from "./retrieve.ts";
import {
	consolidateMemories,
	decayLowValueMemories,
	deleteMemory,
	getAllMemories,
	getMemoriesByTag,
	getMemoriesByTier,
	getMemory,
	promoteOldMemories,
	storeMemories,
	storeMemory,
} from "./store.ts";
import type { Memory } from "./types.ts";

function makeMemory(overrides: Partial<Memory> = {}): Memory {
	return {
		id: `mem_${Date.now()}_${Math.random()}`,
		content: "Test memory content",
		tier: "working",
		importance: 0.5,
		tags: ["test"],
		source: "test",
		createdAt: new Date().toISOString(),
		lastAccessedAt: new Date().toISOString(),
		accessCount: 0,
		expiresAt: null,
		...overrides,
	};
}

async function clearAllMemories() {
	const driver = neo4jClient();
	const session = driver.session();
	try {
		await session.executeWrite((tx) => tx.run(`MATCH (m:Memory) DETACH DELETE m`));
	} finally {
		await session.close();
	}
}

beforeEach(async () => {
	await clearAllMemories();
});

afterAll(async () => {
	await clearAllMemories();
	// Close neo4j driver
	await import("@luna/knowledge").then((m) => m.closeDriver());
});

describe("storeMemory", () => {
	test("stores and retrieves by ID", async () => {
		const mem = makeMemory({ id: "test-1", content: "Hello" });
		await storeMemory(mem);
		const retrieved = await getMemory("test-1");
		expect(retrieved?.content).toBe("Hello");
	});

	test("updates access count and time on retrieval", async () => {
		const mem = makeMemory({ id: "test-2" });
		await storeMemory(mem);
		const initial = await getMemory("test-2");
		expect(initial?.accessCount).toBe(1);

		const second = await getMemory("test-2");
		expect(second?.accessCount).toBe(2);
		expect(new Date(second!.lastAccessedAt).getTime()).toBeGreaterThanOrEqual(
			new Date(initial!.lastAccessedAt).getTime(),
		);
	});

	test("auto-computes expiresAt for working memory", async () => {
		const mem = makeMemory({ id: "test-3", tier: "working", expiresAt: null });
		await storeMemory(mem);
		const retrieved = await getMemory("test-3");
		expect(retrieved?.expiresAt).not.toBeNull();

		const createdAt = new Date(retrieved!.createdAt).getTime();
		const expiresAt = new Date(retrieved!.expiresAt!).getTime();
		expect(expiresAt - createdAt).toBe(24 * 60 * 60 * 1000); // 1 day
	});
});

describe("deleteMemory", () => {
	test("deletes memory", async () => {
		await storeMemory(makeMemory({ id: "del-1" }));
		expect(await getMemory("del-1")).toBeDefined();

		const deleted = await deleteMemory("del-1");
		expect(deleted).toBe(true);
		expect(await getMemory("del-1")).toBeUndefined();
	});

	test("returns false if memory does not exist", async () => {
		expect(await deleteMemory("missing")).toBe(false);
	});
});

describe("getMemoriesByTier & Tag", () => {
	test("filters by tier", async () => {
		await storeMemories([
			makeMemory({ id: "t1", tier: "working" }),
			makeMemory({ id: "t2", tier: "short_term" }),
			makeMemory({ id: "t3", tier: "working" }),
		]);

		const working = await getMemoriesByTier("working");
		expect(working.length).toBe(2);
		expect(working.map((m) => m.id).sort()).toEqual(["t1", "t3"]);
	});

	test("filters by tag", async () => {
		await storeMemories([
			makeMemory({ id: "tag1", tags: ["a", "b"] }),
			makeMemory({ id: "tag2", tags: ["b", "c"] }),
			makeMemory({ id: "tag3", tags: ["d"] }),
		]);

		const bTags = await getMemoriesByTag("b");
		expect(bTags.length).toBe(2);
		expect(bTags.map((m) => m.id).sort()).toEqual(["tag1", "tag2"]);
	});
});

describe("Lifecycle management", () => {
	test("promoteOldMemories promotes frequently accessed working memories", async () => {
		const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
		await storeMemory(
			makeMemory({
				id: "promote-1",
				tier: "working",
				createdAt: oldDate,
				// Give it a future expiration so it isn't cleaned up instantly
				expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
				accessCount: 3,
			}),
		);

		await promoteOldMemories();
		const mem = await getMemory("promote-1");
		expect(mem?.tier).toBe("short_term");
	});

	test("decayLowValueMemories removes unaccessed working memories", async () => {
		const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
		await storeMemories([
			makeMemory({
				id: "decay-1",
				tier: "working",
				importance: 0.1,
				lastAccessedAt: oldDate,
				expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			}),
			makeMemory({
				id: "keep-1",
				tier: "working",
				importance: 0.9,
				lastAccessedAt: new Date().toISOString(),
				expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			}),
		]);
		const deleted = await decayLowValueMemories(0.2);
		expect(deleted).toBe(1);
		expect(await getMemory("decay-1")).toBeUndefined();
		expect(await getMemory("keep-1")).toBeDefined();
	});

	test("consolidateMemories merges exact duplicates", async () => {
		await storeMemory(
			makeMemory({
				id: "dup-1",
				content: "The user's favorite color is blue",
				importance: 0.5,
				tags: ["color"],
				accessCount: 1,
			}),
		);

		await storeMemory(
			makeMemory({
				id: "dup-2",
				content: "The user's favorite color is blue",
				importance: 0.8,
				tags: ["user_preference"],
				accessCount: 2,
			}),
		);

		const consolidated = await consolidateMemories();
		expect(consolidated.length).toBe(1);
		expect(consolidated[0]?.importance).toBe(0.8);
		expect(consolidated[0]?.tags.sort()).toEqual(["color", "user_preference"].sort());
		expect(consolidated[0]?.accessCount).toBe(3);

		// Ensure the DB only has one left
		const all = await getAllMemories();
		expect(all.length).toBe(1);
	});
});

describe("retrieveRelevant", () => {
	test("scores by exact keyword matches", async () => {
		await storeMemories([
			makeMemory({ id: "r1", content: "Alice works at Google" }),
			makeMemory({ id: "r2", content: "Bob works at Microsoft" }),
			makeMemory({ id: "r3", content: "Alice lives in NY" }),
		]);

		const results = await retrieveRelevant("Where does Alice work?");
		expect(results.length).toBeGreaterThan(0);
		expect(results[0]?.id).toBe("r1");
	});

	test("scores by tags", async () => {
		await storeMemories([
			makeMemory({ id: "r4", content: "General info", tags: ["physics", "quantum"] }),
			makeMemory({ content: "Something unrelated" }),
		]);

		const results = await retrieveRelevant("quantum physics");
		expect(results.length).toBeGreaterThan(0);
		expect(results[0]?.id).toBe("r4");
	});
});

describe("formatMemoriesForContext", () => {
	test("formats by tier", () => {
		const formatted = formatMemoriesForContext([
			makeMemory({ content: "Long term fact", tier: "long_term" }),
			makeMemory({ content: "Short term fact", tier: "short_term" }),
			makeMemory({ content: "Working fact", tier: "working" }),
		]);

		expect(formatted).toContain("Long-term memories:");
		expect(formatted).toContain("- Long term fact");
		expect(formatted).toContain("Short-term memories:");
		expect(formatted).toContain("- Short term fact");
		expect(formatted).toContain("Recent context:");
		expect(formatted).toContain("- Working fact");
	});

	test("returns empty string for empty array", () => {
		expect(formatMemoriesForContext([])).toBe("");
	});
});
