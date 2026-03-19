import { describe, expect, test } from "bun:test";
import type { Provenance } from "../types.ts";
import { assignConfidence } from "../validate/confidence.ts";

function makeSource(ref = "test"): Provenance {
	return {
		sourceType: "paste",
		sourceRef: ref,
		rawText: "test text",
		extractedAt: new Date().toISOString(),
	};
}

describe("assignConfidence", () => {
	test("returns base confidence for single source", () => {
		expect(assignConfidence([makeSource()])).toBe(0.6);
	});

	test("returns 0.8 for 2 sources", () => {
		expect(assignConfidence([makeSource("a"), makeSource("b")])).toBe(0.8);
	});

	test("returns 0.85 for 3 sources", () => {
		expect(assignConfidence([makeSource("a"), makeSource("b"), makeSource("c")])).toBe(0.85);
	});

	test("returns 0.95 for 5+ sources", () => {
		const sources = Array.from({ length: 5 }, (_, i) => makeSource(`s${i}`));
		expect(assignConfidence(sources)).toBe(0.95);
	});

	test("accepts custom base confidence", () => {
		expect(assignConfidence([makeSource()], 0.5)).toBe(0.5);
	});

	test("returns 0.6 for empty sources", () => {
		expect(assignConfidence([])).toBe(0.6);
	});
});
