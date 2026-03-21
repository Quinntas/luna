import { eq } from "drizzle-orm";
import { getDb } from "./index.ts";
import { userPreferences } from "./schema.ts";

const DEFAULT_PREFS: Record<string, unknown> = {
	formality: "neutral",
	responseLength: "balanced",
	language: "en",
	topics: [],
	tone: [],
};

const DEFAULT_STYLE: Record<string, unknown> = {
	avgSentenceLength: 15,
	usesEmoji: false,
	usesMarkdown: true,
	commonPhrases: [],
};

function getRow() {
	const db = getDb();
	return db.select().from(userPreferences).where(eq(userPreferences.id, "user")).get();
}

export function getPreferences(): Record<string, unknown> {
	const row = getRow();
	return (row?.preferences as Record<string, unknown>) ?? DEFAULT_PREFS;
}

export function setPreferences(updates: Record<string, unknown>): void {
	const db = getDb();
	const row = getRow();
	const existingPrefs = (row?.preferences as Record<string, unknown>) ?? DEFAULT_PREFS;
	const existingStyle = (row?.styleSignals as Record<string, unknown>) ?? DEFAULT_STYLE;
	const merged = { ...existingPrefs, ...updates };
	db.insert(userPreferences)
		.values({
			id: "user",
			preferences: merged,
			styleSignals: existingStyle,
			updatedAt: new Date().toISOString(),
		})
		.onConflictDoUpdate({
			target: userPreferences.id,
			set: { preferences: merged, updatedAt: new Date().toISOString() },
		})
		.run();
}

export function getStyleSignals(): Record<string, unknown> {
	const row = getRow();
	return (row?.styleSignals as Record<string, unknown>) ?? DEFAULT_STYLE;
}

export function setStyleSignals(signals: Record<string, unknown>): void {
	const db = getDb();
	const row = getRow();
	const existingPrefs = (row?.preferences as Record<string, unknown>) ?? DEFAULT_PREFS;
	const existingStyle = (row?.styleSignals as Record<string, unknown>) ?? DEFAULT_STYLE;
	const merged = { ...existingStyle, ...signals };
	db.insert(userPreferences)
		.values({
			id: "user",
			preferences: existingPrefs,
			styleSignals: merged,
			updatedAt: new Date().toISOString(),
		})
		.onConflictDoUpdate({
			target: userPreferences.id,
			set: { styleSignals: merged, updatedAt: new Date().toISOString() },
		})
		.run();
}

export function resetPreferences(): void {
	const db = getDb();
	db.delete(userPreferences).where(eq(userPreferences.id, "user")).run();
}
