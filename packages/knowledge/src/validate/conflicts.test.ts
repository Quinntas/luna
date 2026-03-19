import { describe, expect, test } from "bun:test";
import type { Entity, Provenance } from "../types.ts";
import { detectConflicts, propertyConflictsToConflicts } from "../validate/conflicts.ts";

function makeEntity(props: Record<string, unknown>, sources: Provenance[] = []): Entity {
	return {
		id: "test-id",
		name: "Test",
		type: "Person",
		aliases: [],
		properties: props,
		confidence: 0.6,
		sources:
			sources.length > 0
				? sources
				: [
						{
							sourceType: "paste",
							sourceRef: "orig",
							rawText: "original",
							extractedAt: new Date().toISOString(),
						},
					],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
}

const newSource: Provenance = {
	sourceType: "file",
	sourceRef: "new-file",
	rawText: "new data",
	extractedAt: new Date().toISOString(),
};

describe("detectConflicts", () => {
	test("detects string conflicts", () => {
		const entity = makeEntity({ role: "Engineer" });
		const conflicts = detectConflicts(entity, { role: "Manager" }, newSource);
		expect(conflicts).toHaveLength(1);
		expect(conflicts[0]?.property).toBe("role");
		expect(conflicts[0]?.existingValue).toBe("Engineer");
		expect(conflicts[0]?.newValue).toBe("Manager");
	});

	test("detects number conflicts", () => {
		const entity = makeEntity({ age: 30 });
		const conflicts = detectConflicts(entity, { age: 25 }, newSource);
		expect(conflicts).toHaveLength(1);
		expect(conflicts[0]?.existingValue).toBe(30);
		expect(conflicts[0]?.newValue).toBe(25);
	});

	test("ignores small number differences", () => {
		const entity = makeEntity({ age: 30 });
		const conflicts = detectConflicts(entity, { age: 30.005 }, newSource);
		expect(conflicts).toHaveLength(0);
	});

	test("ignores identical values", () => {
		const entity = makeEntity({ role: "Engineer" });
		const conflicts = detectConflicts(entity, { role: "Engineer" }, newSource);
		expect(conflicts).toHaveLength(0);
	});

	test("ignores new properties", () => {
		const entity = makeEntity({ role: "Engineer" });
		const conflicts = detectConflicts(entity, { title: "Senior" }, newSource);
		expect(conflicts).toHaveLength(0);
	});

	test("detects boolean conflicts", () => {
		const entity = makeEntity({ active: true });
		const conflicts = detectConflicts(entity, { active: false }, newSource);
		expect(conflicts).toHaveLength(1);
	});

	test("case-insensitive string comparison", () => {
		const entity = makeEntity({ name: "Alice" });
		const conflicts = detectConflicts(entity, { name: "alice" }, newSource);
		expect(conflicts).toHaveLength(0);
	});
});

describe("propertyConflictsToConflicts", () => {
	test("converts property conflicts to Conflict objects", () => {
		const entity = makeEntity({ role: "Engineer" });
		const propConflicts = detectConflicts(entity, { role: "Manager" }, newSource);
		const conflicts = propertyConflictsToConflicts(propConflicts);

		expect(conflicts).toHaveLength(1);
		expect(conflicts[0]?.type).toBe("contradiction");
		expect(conflicts[0]?.resolved).toBe(false);
		expect(conflicts[0]?.facts).toHaveLength(2);
		expect(conflicts[0]?.facts[0]?.value).toBe("Engineer");
		expect(conflicts[0]?.facts[1]?.value).toBe("Manager");
	});
});
