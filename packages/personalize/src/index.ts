import { getPreferences as dbGetPreferences, setPreferences as dbSetPreferences } from "@luna/db";
import type { UserPreferences, UserProfile } from "./types.ts";

const DEFAULT_PREFERENCES: UserPreferences = {
	formality: "neutral",
	responseLength: "balanced",
	language: "en",
	topics: [],
	tone: [],
};

export function getPreferences(): UserPreferences {
	const stored = dbGetPreferences();
	if (Object.keys(stored).length === 0) return DEFAULT_PREFERENCES;
	return { ...DEFAULT_PREFERENCES, ...stored } as UserPreferences;
}

export function setPreferences(updates: Partial<UserPreferences>): void {
	const existing = getPreferences();
	dbSetPreferences({ ...existing, ...updates });
}

export function getProfile(): UserProfile {
	return {
		id: "user",
		preferences: getPreferences(),
		styleSignals: {
			avgSentenceLength: 15,
			usesEmoji: false,
			usesMarkdown: true,
			commonPhrases: [],
		},
		updatedAt: new Date().toISOString(),
	};
}

export function adaptSystemPrompt(basePrompt: string): string {
	const prefs = getPreferences();
	const instructions: string[] = [];

	if (prefs.formality === "casual") {
		instructions.push("Use casual, friendly language. Contractions are fine.");
	} else if (prefs.formality === "formal") {
		instructions.push("Use formal, professional language.");
	}

	if (prefs.responseLength === "concise") {
		instructions.push("Keep responses brief and to the point.");
	} else if (prefs.responseLength === "detailed") {
		instructions.push("Provide detailed, thorough responses.");
	}

	if (prefs.tone.length > 0) {
		instructions.push(`Tone: ${prefs.tone.join(", ")}.`);
	}

	if (instructions.length === 0) return basePrompt;

	return `${basePrompt}\n\nUser preferences:\n${instructions.join("\n")}`;
}

export function learnFromFeedback(correction: string, _context: string): void {
	const prefs = getPreferences();

	if (correction.includes("shorter") || correction.includes("brief")) {
		prefs.responseLength = "concise";
	} else if (correction.includes("more detail") || correction.includes("elaborate")) {
		prefs.responseLength = "detailed";
	}

	if (correction.includes("formal")) {
		prefs.formality = "formal";
	} else if (correction.includes("casual") || correction.includes("friendly")) {
		prefs.formality = "casual";
	}

	setPreferences(prefs);
}
