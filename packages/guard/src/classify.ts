import type { SensitivityLevel } from "./types.ts";

const SENSITIVE_KEYWORDS: Record<SensitivityLevel, string[]> = {
	restricted: [
		"ssn",
		"social security",
		"credit card",
		"bank account",
		"password",
		"medical record",
		"health",
		"diagnosis",
		"prescription",
		"therapy",
		"passport",
		"driver license",
	],
	confidential: [
		"salary",
		"compensation",
		"tax",
		"w2",
		"1099",
		"invoice",
		"contract",
		"nda",
		"confidential",
		"private",
		"personal",
	],
	internal: [
		"meeting notes",
		"internal",
		"team",
		"project",
		"sprint",
		"roadmap",
		"okr",
		"quarterly",
	],
	public: [],
};

const WEIGHTS: Record<SensitivityLevel, number> = {
	restricted: 4,
	confidential: 3,
	internal: 2,
	public: 1,
};

export function classifySensitivity(text: string): SensitivityLevel {
	const lower = text.toLowerCase();
	let maxLevel: SensitivityLevel = "public";
	let maxWeight = 0;

	for (const [level, keywords] of Object.entries(SENSITIVE_KEYWORDS)) {
		const weight = WEIGHTS[level as SensitivityLevel];
		for (const keyword of keywords) {
			if (lower.includes(keyword) && weight > maxWeight) {
				maxLevel = level as SensitivityLevel;
				maxWeight = weight;
			}
		}
	}

	return maxLevel;
}
