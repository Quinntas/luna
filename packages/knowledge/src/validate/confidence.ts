import type { Provenance } from "../types.ts";

export function assignConfidence(sources: Provenance[], _baseConfidence = 0.6): number {
	const sourceCount = sources.length;

	if (sourceCount >= 5) return 0.95;
	if (sourceCount >= 3) return 0.85;
	if (sourceCount >= 2) return 0.8;
	return _baseConfidence;
}
