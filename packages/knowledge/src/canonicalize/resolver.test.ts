import { describe, expect, test } from "bun:test";
import { normalizeRelations, normalizeRelationType } from "../canonicalize/resolver.ts";

describe("normalizeRelationType", () => {
	test("returns canonical form for known synonyms", () => {
		expect(normalizeRelationType("WORKS_FOR")).toBe("WORKS_AT");
		expect(normalizeRelationType("EMPLOYED_BY")).toBe("WORKS_AT");
		expect(normalizeRelationType("WORKING_AT")).toBe("WORKS_AT");
		expect(normalizeRelationType("EMPLOYED_AT")).toBe("WORKS_AT");
	});

	test("normalizes location variants", () => {
		expect(normalizeRelationType("BASED_IN")).toBe("LOCATED_IN");
		expect(normalizeRelationType("SITUATED_IN")).toBe("LOCATED_IN");
		expect(normalizeRelationType("HQ_IN")).toBe("LOCATED_IN");
	});

	test("normalizes membership variants", () => {
		expect(normalizeRelationType("PART_OF")).toBe("MEMBER_OF");
		expect(normalizeRelationType("BELONGS_TO")).toBe("MEMBER_OF");
	});

	test("normalizes social variants", () => {
		expect(normalizeRelationType("KNOWS")).toBe("ACQUAINTED_WITH");
		expect(normalizeRelationType("FRIEND_OF")).toBe("ACQUAINTED_WITH");
	});

	test("returns unknown types unchanged", () => {
		expect(normalizeRelationType("CUSTOM_RELATION")).toBe("CUSTOM_RELATION");
		expect(normalizeRelationType("MENTIONS")).toBe("MENTIONS");
		expect(normalizeRelationType("LOCATED_IN")).toBe("LOCATED_IN");
		expect(normalizeRelationType("WORKS_AT")).toBe("WORKS_AT");
	});
});

describe("normalizeRelations", () => {
	test("normalizes all relations in an array", () => {
		const input = [
			{ source: "Alice", target: "Google", type: "WORKS_FOR", properties: {} },
			{ source: "Google", target: "CA", type: "BASED_IN", properties: {} },
		];
		const result = normalizeRelations(input);
		expect(result[0]?.type).toBe("WORKS_AT");
		expect(result[1]?.type).toBe("LOCATED_IN");
	});

	test("preserves other fields", () => {
		const input = [
			{ source: "Alice", target: "Google", type: "WORKS_FOR", properties: { since: 2020 } },
		];
		const result = normalizeRelations(input);
		expect(result[0]?.source).toBe("Alice");
		expect(result[0]?.target).toBe("Google");
		expect(result[0]?.properties).toEqual({ since: 2020 });
	});

	test("handles empty array", () => {
		expect(normalizeRelations([])).toEqual([]);
	});
});
