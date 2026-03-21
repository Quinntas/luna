import type { PIIMatch, PIIType } from "./types.ts";

interface Pattern {
	type: PIIType;
	regex: RegExp;
	validate?: (match: string) => boolean;
}

const PATTERNS: Pattern[] = [
	{
		type: "ssn",
		regex: /\b\d{3}-?\d{2}-?\d{4}\b/g,
	},
	{
		type: "email",
		regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
	},
	{
		type: "phone",
		regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
		validate: (match) => {
			const digits = match.replace(/\D/g, "");
			return digits.length === 10 || digits.length === 11;
		},
	},
	{
		type: "credit_card",
		regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
		validate: luhnCheck,
	},
	{
		type: "ip_address",
		regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
		validate: (match) => {
			const parts = match.split(".").map(Number);
			return parts.every((p) => p >= 0 && p <= 255);
		},
	},
	{
		type: "date_of_birth",
		regex: /\b(?:DOB|dob|birth(?:date|day)?|born)[:\s]+\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
	},
];

function luhnCheck(num: string): boolean {
	const digits = num.replace(/\D/g, "");
	if (digits.length < 13 || digits.length > 19) return false;

	let sum = 0;
	let alternate = false;
	for (let i = digits.length - 1; i >= 0; i--) {
		let n = Number(digits[i]);
		if (alternate) {
			n *= 2;
			if (n > 9) n -= 9;
		}
		sum += n;
		alternate = !alternate;
	}
	return sum % 10 === 0;
}

export function detectPII(text: string, types?: PIIType[]): PIIMatch[] {
	const matches: PIIMatch[] = [];
	const patterns = types ? PATTERNS.filter((p) => types.includes(p.type)) : PATTERNS;

	for (const pattern of patterns) {
		const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
		let match = regex.exec(text);

		while (match !== null) {
			const value = match[0];
			if (!pattern.validate || pattern.validate(value)) {
				matches.push({
					type: pattern.type,
					value,
					start: match.index,
					end: match.index + value.length,
				});
			}
			match = regex.exec(text);
		}
	}

	return matches.sort((a, b) => a.start - b.start);
}
