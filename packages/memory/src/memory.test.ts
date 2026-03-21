import { beforeEach, describe, expect, test } from "bun:test";
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

function clearAllMemories() {
	for (const m of getAllMemories()) {
		deleteMemory(m.id);
	}
}

beforeEach(() => {
	clearAllMemories();
});

describe("storeMemory", () => {
	test("stores and retrieves by ID", () => {
		const mem = makeMemory({ id: "test-1", content: "Hello" });
		storeMemory(mem);
		expect(getMemory("test-1")?.content).toBe("Hello");
	});

	test("increments access count on get", () => {
		const mem = makeMemory({ id: "test-2", accessCount: 0 });
		storeMemory(mem);
		getMemory("test-2");
		getMemory("test-2");
		const retrieved = getMemory("test-2");
		// 2 gets before this + 1 in the expect = 3 accesses total
		expect(retrieved?.accessCount).toBe(3);
	});

	test("returns undefined for missing ID", () => {
		expect(getMemory("missing")).toBeUndefined();
	});
});

describe("storeMemories", () => {
	test("stores multiple memories", () => {
		storeMemories([makeMemory({ id: "m1" }), makeMemory({ id: "m2" })]);
		expect(getAllMemories()).toHaveLength(2);
	});
});

describe("deleteMemory", () => {
	test("deletes existing memory", () => {
		storeMemory(makeMemory({ id: "del-1" }));
		expect(deleteMemory("del-1")).toBe(true);
		expect(getMemory("del-1")).toBeUndefined();
	});

	test("returns false for missing", () => {
		expect(deleteMemory("missing")).toBe(false);
	});
});

describe("getMemoriesByTier", () => {
	test("filters by tier", () => {
		storeMemories([
			makeMemory({ id: "w1", tier: "working" }),
			makeMemory({ id: "s1", tier: "short_term" }),
			makeMemory({ id: "l1", tier: "long_term" }),
		]);
		expect(getMemoriesByTier("short_term")).toHaveLength(1);
		expect(getMemoriesByTier("short_term")[0]?.id).toBe("s1");
	});
});

describe("getMemoriesByTag", () => {
	test("filters by tag", () => {
		storeMemories([
			makeMemory({ id: "t1", tags: ["work", "urgent"] }),
			makeMemory({ id: "t2", tags: ["personal"] }),
		]);
		expect(getMemoriesByTag("work")).toHaveLength(1);
		expect(getMemoriesByTag("work")[0]?.id).toBe("t1");
	});
});

describe("consolidateMemories", () => {
	test("merges duplicate content", () => {
		storeMemories([
			makeMemory({ id: "c1", content: "Alice works at Google", importance: 0.5 }),
			makeMemory({ id: "c2", content: "Alice works at Google", importance: 0.9 }),
		]);
		const consolidated = consolidateMemories();
		const matching = consolidated.filter((m) => m.content.startsWith("Alice works at Google"));
		expect(matching).toHaveLength(1);
		expect(matching[0]?.importance).toBe(0.9);
	});

	test("merges tags from duplicates", () => {
		storeMemories([
			makeMemory({ id: "ct1", content: "Same content", tags: ["a"] }),
			makeMemory({ id: "ct2", content: "Same content", tags: ["b"] }),
		]);
		const consolidated = consolidateMemories();
		const match = consolidated.find((m) => m.content === "Same content");
		expect(match?.tags).toContain("a");
		expect(match?.tags).toContain("b");
	});
});

describe("promoteOldMemories", () => {
	test("keeps working tier for young memories", () => {
		const old = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
		storeMemory(
			makeMemory({
				id: "promote-1",
				tier: "working",
				createdAt: old,
				accessCount: 3,
			}),
		);
		promoteOldMemories();
		// 12h old, 3 accesses — not old enough for promotion (>24h required)
		expect(getMemory("promote-1")?.tier).toBe("working");
	});
});

describe("decayLowValueMemories", () => {
	test("removes low-importance working memories", () => {
		const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
		storeMemories([
			makeMemory({
				id: "decay-1",
				tier: "working",
				importance: 0.1,
				lastAccessedAt: old,
			}),
			makeMemory({
				id: "keep-1",
				tier: "working",
				importance: 0.9,
				lastAccessedAt: new Date().toISOString(),
			}),
		]);
		const deleted = decayLowValueMemories(0.2);
		expect(deleted).toBe(1);
		expect(getMemory("decay-1")).toBeUndefined();
		expect(getMemory("keep-1")).toBeDefined();
	});
});

describe("retrieveRelevant", () => {
	test("returns matching memories by content", () => {
		storeMemories([
			makeMemory({ id: "r1", content: "Alice works at Google as engineer" }),
			makeMemory({ id: "r2", content: "Bob likes pizza" }),
		]);
		const results = retrieveRelevant("Where does Alice work?");
		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(results[0]?.id).toBe("r1");
	});

	test("returns empty for no matches", () => {
		storeMemory(makeMemory({ content: "Something unrelated" }));
		const results = retrieveRelevant("quantum physics");
		expect(results).toHaveLength(0);
	});
});

describe("formatMemoriesForContext", () => {
	test("groups by tier", () => {
		const memories: Memory[] = [
			makeMemory({ id: "f1", tier: "long_term", content: "Long term fact" }),
			makeMemory({ id: "f2", tier: "short_term", content: "Recent thing" }),
			makeMemory({ id: "f3", tier: "working", content: "Current context" }),
		];
		const formatted = formatMemoriesForContext(memories);
		expect(formatted).toContain("Long-term memories:");
		expect(formatted).toContain("Short-term memories:");
		expect(formatted).toContain("Recent context:");
		expect(formatted).toContain("Long term fact");
		expect(formatted).toContain("Recent thing");
		expect(formatted).toContain("Current context");
	});

	test("returns empty string for empty array", () => {
		expect(formatMemoriesForContext([])).toBe("");
	});
});
