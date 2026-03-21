import { detectPII } from "./detect.ts";
import type { GuardOptions, PIIMatch } from "./types.ts";

export interface RedactionResult {
	text: string;
	matches: PIIMatch[];
}

export function redactPII(text: string, options: GuardOptions = {}): RedactionResult {
	const { redactWith = "[REDACTED]" } = options;
	const matches = detectPII(text, options.types);

	if (matches.length === 0) return { text, matches: [] };

	let result = "";
	let lastEnd = 0;

	for (const match of matches) {
		result += text.slice(lastEnd, match.start);
		result += redactWith;
		lastEnd = match.end;
	}
	result += text.slice(lastEnd);

	return { text: result, matches };
}

export function hasPII(text: string, types?: GuardOptions["types"]): boolean {
	return detectPII(text, types).length > 0;
}

export function filterInput(text: string, options: GuardOptions = {}): string {
	return redactPII(text, options).text;
}
