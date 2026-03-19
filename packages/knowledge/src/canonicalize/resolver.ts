import { createEntityId } from "../graph/upsert.ts";
import type { Entity, ExtractedEntity, ExtractedRelation, Provenance } from "../types.ts";

const RELATION_SYNONYMS: Record<string, string> = {
	WORKS_FOR: "WORKS_AT",
	EMPLOYED_BY: "WORKS_AT",
	WORKING_AT: "WORKS_AT",
	EMPLOYED_AT: "WORKS_AT",
	BASED_IN: "LOCATED_IN",
	SITUATED_IN: "LOCATED_IN",
	HEADQUARTERED_IN: "LOCATED_IN",
	HQ_IN: "LOCATED_IN",
	PART_OF: "MEMBER_OF",
	BELONGS_TO: "MEMBER_OF",
	KNOWS: "ACQUAINTED_WITH",
	FRIEND_OF: "ACQUAINTED_WITH",
	COLLEAGUE_OF: "WORKS_WITH",
	CO_FOUNDER: "CO_FOUNDER_OF",
};

export function normalizeRelationType(type: string): string {
	return RELATION_SYNONYMS[type] ?? type;
}

export function normalizeRelations(relations: ExtractedRelation[]): ExtractedRelation[] {
	return relations.map((rel) => ({
		...rel,
		type: normalizeRelationType(rel.type),
	}));
}

function levenshtein(a: string, b: string): number {
	const m = a.length;
	const n = b.length;

	const dp: number[][] = [];
	for (let i = 0; i <= m; i++) {
		const row = new Array<number>(n + 1).fill(0);
		row[0] = i;
		dp.push(row);
	}
	for (let j = 0; j <= n; j++) {
		dp[0]![j] = j;
	}

	for (let i = 1; i <= m; i++) {
		const prevRow = dp[i - 1]!;
		const currRow = dp[i]!;
		for (let j = 1; j <= n; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			currRow[j] = Math.min(prevRow[j]! + 1, currRow[j - 1]! + 1, prevRow[j - 1]! + cost);
		}
	}

	return dp[m]![n]!;
}

function similarity(a: string, b: string): number {
	const la = a.toLowerCase().trim();
	const lb = b.toLowerCase().trim();
	if (la === lb) return 1;
	const maxLen = Math.max(la.length, lb.length);
	if (maxLen === 0) return 1;
	return 1 - levenshtein(la, lb) / maxLen;
}

function hasOverlap(a: string[], b: string[]): boolean {
	const setA = new Set(a.map((s) => s.toLowerCase()));
	for (const s of b) {
		if (setA.has(s.toLowerCase())) return true;
	}
	return false;
}

export interface CanonicalizedEntity {
	entity: Omit<Entity, "id" | "createdAt" | "updatedAt">;
	action: "create" | "merge";
	mergedIntoId?: string;
}

export function canonicalizeEntities(
	extracted: ExtractedEntity[],
	existing: Entity[],
	provenance: Provenance,
): CanonicalizedEntity[] {
	const results: CanonicalizedEntity[] = [];

	for (const ext of extracted) {
		const id = createEntityId(ext.name, ext.type);

		// 1. Exact ID match
		const exact = existing.find((e) => e.id === id);
		if (exact) {
			results.push({
				entity: {
					name: exact.name,
					type: exact.type,
					aliases: [...new Set([...exact.aliases, ext.name, ...ext.aliases])],
					properties: { ...ext.properties, ...exact.properties },
					confidence: exact.confidence,
					sources: [...exact.sources, provenance],
				},
				action: "merge",
				mergedIntoId: exact.id,
			});
			continue;
		}

		// 2. Same type + high name similarity
		const sameType = existing.filter((e) => e.type === ext.type);
		let best: Entity | undefined;
		let bestScore = 0;

		for (const candidate of sameType) {
			const nameSim = similarity(candidate.name, ext.name);
			const aliasSim =
				hasOverlap(candidate.aliases, [ext.name]) ||
				hasOverlap([ext.name], candidate.aliases) ||
				hasOverlap(candidate.aliases, ext.aliases);

			const score = aliasSim ? Math.max(nameSim, 0.85) : nameSim;
			if (score > bestScore && score >= 0.85) {
				bestScore = score;
				best = candidate;
			}
		}

		if (best) {
			results.push({
				entity: {
					name: best.name,
					type: best.type,
					aliases: [...new Set([...best.aliases, ext.name, ...ext.aliases])],
					properties: { ...ext.properties, ...best.properties },
					confidence: best.confidence,
					sources: [...best.sources, provenance],
				},
				action: "merge",
				mergedIntoId: best.id,
			});
			continue;
		}

		// 3. No match — create new
		results.push({
			entity: {
				name: ext.name,
				type: ext.type,
				aliases: ext.aliases,
				properties: ext.properties,
				confidence: 0.6,
				sources: [provenance],
			},
			action: "create",
		});
	}

	return results;
}
