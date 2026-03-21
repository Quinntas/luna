import { describe, expect, test } from "bun:test";
import { createProvenance, mergeProvenance, provenanceSummary } from "../validate/provenance.ts";
import { createEntityId, neo4jToEntity } from "./upsert.ts";
import { analyzeWritingStyle } from "./user.ts";

describe("createProvenance", () => {
	test("creates provenance with all fields", () => {
		const p = createProvenance("file", "test.md", "some text", 0);
		expect(p.sourceType).toBe("file");
		expect(p.sourceRef).toBe("test.md");
		expect(p.rawText).toBe("some text");
		expect(p.chunkIndex).toBe(0);
		expect(p.extractedAt).toBeDefined();
	});

	test("creates provenance without chunkIndex", () => {
		const p = createProvenance("paste", "stdin", "text");
		expect(p.chunkIndex).toBeUndefined();
	});
});

describe("mergeProvenance", () => {
	test("deduplicates by source+ref+chunk", () => {
		const a = createProvenance("file", "test.md", "text", 0);
		const b = createProvenance("file", "test.md", "text", 0);
		const merged = mergeProvenance([a], [b]);
		expect(merged).toHaveLength(1);
	});

	test("keeps different sources", () => {
		const a = createProvenance("file", "test.md", "text");
		const b = createProvenance("paste", "stdin", "text");
		const merged = mergeProvenance([a], [b]);
		expect(merged).toHaveLength(2);
	});

	test("keeps different chunkIndex", () => {
		const a = createProvenance("file", "test.md", "text", 0);
		const b = createProvenance("file", "test.md", "text", 1);
		const merged = mergeProvenance([a], [b]);
		expect(merged).toHaveLength(2);
	});
});

describe("provenanceSummary", () => {
	test("counts by source type", () => {
		const sources = [
			createProvenance("file", "a.md", "x"),
			createProvenance("file", "b.md", "x"),
			createProvenance("paste", "stdin", "x"),
		];
		const summary = provenanceSummary(sources);
		expect(summary).toContain("2 file");
		expect(summary).toContain("1 paste");
	});
});

describe("createEntityId", () => {
	test("generates deterministic ID", () => {
		const id1 = createEntityId("Alice", "Person");
		const id2 = createEntityId("Alice", "Person");
		expect(id1).toBe(id2);
	});

	test("different names produce different IDs", () => {
		const id1 = createEntityId("Alice", "Person");
		const id2 = createEntityId("Bob", "Person");
		expect(id1).not.toBe(id2);
	});

	test("different types produce different IDs", () => {
		const id1 = createEntityId("Google", "Organization");
		const id2 = createEntityId("Google", "Concept");
		expect(id1).not.toBe(id2);
	});

	test("normalizes case and whitespace", () => {
		const id1 = createEntityId("Alice Smith", "Person");
		const id2 = createEntityId("  alice   smith  ", "Person");
		expect(id1).toBe(id2);
	});
});

describe("neo4jToEntity", () => {
	test("converts Neo4j props to Entity", () => {
		const entity = neo4jToEntity({
			id: "test-1",
			name: "Alice",
			type: "Person",
			aliases: ["Alice Smith"],
			properties: JSON.stringify({ role: "Engineer" }),
			confidence: 0.8,
			sources: JSON.stringify([
				{
					sourceType: "file",
					sourceRef: "test.md",
					rawText: "Alice is an engineer",
					extractedAt: "2026-01-01",
				},
			]),
			createdAt: "2026-01-01",
			updatedAt: "2026-01-01",
		});
		expect(entity.id).toBe("test-1");
		expect(entity.name).toBe("Alice");
		expect(entity.type).toBe("Person");
		expect(entity.aliases).toEqual(["Alice Smith"]);
		expect(entity.properties).toEqual({ role: "Engineer" });
		expect(entity.confidence).toBe(0.8);
		expect(entity.sources).toHaveLength(1);
		expect(entity.sources[0]?.sourceType).toBe("file");
	});

	test("handles missing fields gracefully", () => {
		const entity = neo4jToEntity({
			id: "test-2",
			name: "Bob",
			type: "Person",
		});
		expect(entity.aliases).toEqual([]);
		expect(entity.properties).toEqual({});
		expect(entity.sources).toEqual([]);
	});

	test("handles already-parsed properties", () => {
		const entity = neo4jToEntity({
			id: "test-3",
			name: "Carol",
			type: "Person",
			properties: { key: "value" },
			sources: [],
		});
		expect(entity.properties).toEqual({ key: "value" });
	});
});

describe("analyzeWritingStyle", () => {
	test("calculates average sentence length", async () => {
		const style = analyzeWritingStyle([
			"This is a short sentence. This is another short one.",
			"Here is a medium length sentence with more words in it.",
		]);
		expect(style.avgSentenceLength).toBeGreaterThan(0);
		expect(style.avgSentenceLength).toBeLessThan(30);
	});

	test("detects casual for short sentences", async () => {
		const style = analyzeWritingStyle(["Hi. Hey. Hello. Yo. What's up."]);
		expect(style.formality).toBe("casual");
	});

	test("extracts common terms", async () => {
		const style = analyzeWritingStyle([
			"The React framework is great. React components are reusable. I love React development.",
		]);
		expect(style.commonTerms).toContain("react");
	});

	test("returns neutral for medium sentences", async () => {
		const style = analyzeWritingStyle([
			"This sentence has a reasonable number of words for testing the formality detection purposes.",
		]);
		expect(style.formality).toBe("neutral");
	});
});
