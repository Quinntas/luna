import type { HistoryEntry } from "../types.ts";

export function addUserEntry(history: HistoryEntry[], content: string): HistoryEntry[] {
	const entry: HistoryEntry = { role: "user", content };
	return [entry, ...history];
}

export function addAssistantEntry(history: HistoryEntry[], content: string): HistoryEntry[] {
	const entry: HistoryEntry = { role: "assistant", content };
	return [entry, ...history];
}

export function getUserMessages(history: HistoryEntry[]): HistoryEntry[] {
	return history.filter((h) => h.role === "user");
}

export function hasUserMessages(history: HistoryEntry[]): boolean {
	return history.some((h) => h.role === "user");
}

export function getHistoryAtIndex(userMessages: HistoryEntry[], index: number): string | undefined {
	return userMessages[index]?.content;
}
