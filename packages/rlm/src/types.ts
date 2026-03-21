import type { LanguageModel } from "ai";

export interface RLMConfig {
	model: LanguageModel;
	subModel?: LanguageModel;
	maxIterations?: number;
	maxOutputChars?: number;
	memoryLimit?: number;
}

export interface RLMResult {
	answer: string;
	iterations: number;
	trajectory: RLMTrajectoryStep[];
}

export interface RLMTrajectoryStep {
	role: "assistant" | "execution" | "final";
	content: string;
	code?: string;
}
