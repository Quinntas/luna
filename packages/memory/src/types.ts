export type MemoryTier = "working" | "short_term" | "long_term";

export interface Memory {
	id: string;
	content: string;
	tier: MemoryTier;
	importance: number;
	tags: string[];
	source: string;
	createdAt: string;
	lastAccessedAt: string;
	accessCount: number;
	expiresAt: string | null;
}

export interface ConversationMessage {
	role: "user" | "assistant";
	content: string;
	timestamp?: string;
}
