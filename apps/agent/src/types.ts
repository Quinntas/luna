import type { LanguageModel } from "ai";

export interface AgentConfig {
	model: LanguageModel;
	maxSteps?: number;
	history?: { role: "user" | "assistant"; content: string }[];
	user?: string;
}

export interface AgentResponse {
	answer: string;
	moodStatus: string;
	toolCalls: { name: string; input: unknown; result: string }[];
	memoriesExtracted: number;
	sensitivityLevel: string;
	usage: { promptTokens: number; completionTokens: number; totalTokens: number };
	durationMs: number;
}
