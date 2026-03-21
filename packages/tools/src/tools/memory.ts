import { z } from "zod";
import type { ToolDefinition } from "../types.ts";

const queryMemorySchema = z.object({
	query: z.string().describe("What to search for in memories"),
	limit: z.number().optional().describe("Max memories to return (default 5)"),
});

const storeMemorySchema = z.object({
	content: z.string().describe("The fact or information to remember"),
	tags: z.array(z.string()).optional().describe("Tags to categorize this memory"),
	importance: z.enum(["low", "medium", "high"]).optional().describe("Importance level"),
});

type QueryMemoryInput = z.infer<typeof queryMemorySchema>;
type StoreMemoryInput = z.infer<typeof storeMemorySchema>;

export const queryMemoryTool: ToolDefinition<QueryMemoryInput> = {
	name: "query_memory",
	description: "Search stored memories for relevant information about the user.",
	schema: queryMemorySchema,
	execute: async ({ query, limit = 5 }) => {
		try {
			const { retrieveRelevant, formatMemoriesForContext } = await import("@luna/memory");
			const memories = await retrieveRelevant(query, limit);
			if (memories.length === 0) return "No relevant memories found.";
			return formatMemoriesForContext(memories);
		} catch (err) {
			return `Memory query failed: ${err instanceof Error ? err.message : String(err)}`;
		}
	},
	tags: ["memory", "recall", "search", "past"],
};

export const storeMemoryTool: ToolDefinition<StoreMemoryInput> = {
	name: "store_memory",
	description:
		"Store a new memory about the user. Use this to remember important facts, preferences, or events.",
	schema: storeMemorySchema,
	execute: async ({ content, tags = [], importance = "medium" }) => {
		try {
			const { storeMemory } = await import("@luna/memory");
			const now = new Date().toISOString();
			const tier =
				importance === "high" ? "long_term" : importance === "medium" ? "short_term" : "working";

			await storeMemory({
				id: `mem_${crypto.randomUUID()}`,
				content,
				tier,
				importance: importance === "high" ? 0.9 : importance === "medium" ? 0.6 : 0.3,
				tags,
				source: "agent",
				createdAt: now,
				lastAccessedAt: now,
				accessCount: 0,
				expiresAt: null,
			});

			return `Memory stored: "${content}" [${tier}]`;
		} catch (err) {
			return `Failed to store memory: ${err instanceof Error ? err.message : String(err)}`;
		}
	},
	tags: ["memory", "store", "remember", "save"],
};
