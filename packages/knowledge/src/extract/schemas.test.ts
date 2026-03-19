import { describe, expect, test } from "bun:test";
import { extractionOutputSchema } from "../extract/schemas.ts";

describe("extractionOutputSchema", () => {
	test("validates correct extraction output", () => {
		const input = {
			entities: [
				{
					name: "Alice",
					type: "Person",
					aliases: ["Alice Smith"],
					properties: { role: "Engineer" },
				},
			],
			relations: [
				{
					source: "Alice",
					target: "Google",
					type: "WORKS_AT",
					properties: {},
				},
			],
			summary: "Alice works at Google as an engineer.",
		};
		const result = extractionOutputSchema.safeParse(input);
		expect(result.success).toBe(true);
	});

	test("accepts empty entities and relations", () => {
		const input = {
			entities: [],
			relations: [],
			summary: "Nothing to extract.",
		};
		const result = extractionOutputSchema.safeParse(input);
		expect(result.success).toBe(true);
	});

	test("rejects missing summary", () => {
		const input = {
			entities: [],
			relations: [],
		};
		const result = extractionOutputSchema.safeParse(input);
		expect(result.success).toBe(false);
	});

	test("rejects entity without name", () => {
		const input = {
			entities: [{ type: "Person", aliases: [], properties: {} }],
			relations: [],
			summary: "test",
		};
		const result = extractionOutputSchema.safeParse(input);
		expect(result.success).toBe(false);
	});

	test("rejects relation without source", () => {
		const input = {
			entities: [],
			relations: [{ target: "Google", type: "WORKS_AT", properties: {} }],
			summary: "test",
		};
		const result = extractionOutputSchema.safeParse(input);
		expect(result.success).toBe(false);
	});

	test("accepts custom entity types", () => {
		const input = {
			entities: [
				{
					name: "React",
					type: "Framework",
					aliases: [],
					properties: {},
				},
			],
			relations: [],
			summary: "React is a framework.",
		};
		const result = extractionOutputSchema.safeParse(input);
		expect(result.success).toBe(true);
	});

	test("aliases must be strings", () => {
		const input = {
			entities: [
				{
					name: "Alice",
					type: "Person",
					aliases: [123],
					properties: {},
				},
			],
			relations: [],
			summary: "test",
		};
		const result = extractionOutputSchema.safeParse(input);
		expect(result.success).toBe(false);
	});
});
