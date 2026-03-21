import type { z } from "zod";

export interface ToolDefinition<T = unknown> {
	name: string;
	description: string;
	schema: z.ZodType<T>;
	execute: (input: T) => Promise<string>;
	tags?: string[];
}

export interface ToolSelection {
	tool: string;
	confidence: number;
	reasoning: string;
}
