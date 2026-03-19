import type { Provenance } from "../types.ts";

export function createProvenance(
	sourceType: Provenance["sourceType"],
	sourceRef: string,
	rawText: string,
	chunkIndex?: number,
): Provenance {
	return {
		sourceType,
		sourceRef,
		rawText,
		chunkIndex,
		extractedAt: new Date().toISOString(),
	};
}

export function mergeProvenance(a: Provenance[], b: Provenance[]): Provenance[] {
	const seen = new Set<string>();
	const merged: Provenance[] = [];

	for (const p of [...a, ...b]) {
		const key = `${p.sourceType}:${p.sourceRef}:${p.chunkIndex ?? ""}`;
		if (!seen.has(key)) {
			seen.add(key);
			merged.push(p);
		}
	}

	return merged;
}

export function provenanceSummary(sources: Provenance[]): string {
	const byType: Record<string, number> = {};
	for (const s of sources) {
		byType[s.sourceType] = (byType[s.sourceType] ?? 0) + 1;
	}
	return Object.entries(byType)
		.map(([type, count]) => `${count} ${type}`)
		.join(", ");
}
