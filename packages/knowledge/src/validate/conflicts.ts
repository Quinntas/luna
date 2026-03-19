import type { Conflict, Entity, Provenance } from "../types.ts";

interface PropertyConflict {
	entityId: string;
	entityName: string;
	property: string;
	existingValue: unknown;
	newValue: unknown;
	existingSource: Provenance;
	newSource: Provenance;
}

export function detectConflicts(
	existingEntity: Entity,
	newProperties: Record<string, unknown>,
	newSource: Provenance,
): PropertyConflict[] {
	const conflicts: PropertyConflict[] = [];

	for (const [key, newVal] of Object.entries(newProperties)) {
		const existingVal = existingEntity.properties[key];
		if (existingVal === undefined) continue;

		// Skip if values are identical
		if (JSON.stringify(existingVal) === JSON.stringify(newVal)) continue;

		// Only flag as conflict for specific types of properties
		if (isConflictingValue(existingVal, newVal)) {
			const existingSource = existingEntity.sources[0];
			if (!existingSource) continue;
			conflicts.push({
				entityId: existingEntity.id,
				entityName: existingEntity.name,
				property: key,
				existingValue: existingVal,
				newValue: newVal,
				existingSource,
				newSource,
			});
		}
	}

	return conflicts;
}

function isConflictingValue(a: unknown, b: unknown): boolean {
	// Numbers that differ by more than rounding
	if (typeof a === "number" && typeof b === "number") {
		return Math.abs(a - b) > 0.01;
	}

	// Strings that are different
	if (typeof a === "string" && typeof b === "string") {
		return a.toLowerCase().trim() !== b.toLowerCase().trim();
	}

	// Booleans that differ
	if (typeof a === "boolean" && typeof b === "boolean") {
		return a !== b;
	}

	return false;
}

export function propertyConflictsToConflicts(
	propConflicts: ReturnType<typeof detectConflicts>,
): Conflict[] {
	return propConflicts.map((pc) => ({
		id: Bun.hash(
			`${pc.entityId}:${pc.property}:${JSON.stringify(pc.existingValue)}:${JSON.stringify(pc.newValue)}`,
		).toString(16),
		type: "contradiction" as const,
		facts: [
			{
				entityId: pc.entityId,
				property: pc.property,
				value: pc.existingValue,
				source: pc.existingSource,
			},
			{
				entityId: pc.entityId,
				property: pc.property,
				value: pc.newValue,
				source: pc.newSource,
			},
		],
		resolved: false,
	}));
}
