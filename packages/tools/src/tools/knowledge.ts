import { z } from "zod";
import type { ToolDefinition } from "../types.ts";

const queryKnowledgeSchema = z.object({
	query: z.string().describe("Search query — entity name or keyword"),
	type: z
		.string()
		.optional()
		.describe("Filter by entity type (Person, Organization, Project, etc.)"),
	limit: z.number().optional().describe("Max results (default 5)"),
});

type QueryKnowledgeInput = z.infer<typeof queryKnowledgeSchema>;

export const queryKnowledgeTool: ToolDefinition<QueryKnowledgeInput> = {
	name: "query_knowledge",
	description: "Search the knowledge graph for entities, relationships, and facts.",
	schema: queryKnowledgeSchema,
	execute: async ({ query, type, limit = 5 }) => {
		try {
			const { searchEntities, queryRelated } = await import("@luna/knowledge");
			const entities = await searchEntities(query, { type, limit });

			if (entities.length === 0) {
				return `No entities found for "${query}"`;
			}

			const results: string[] = [];
			for (const entity of entities) {
				const props = Object.entries(entity.properties)
					.map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
					.join(", ");
				let line = `${entity.type}: ${entity.name} (confidence: ${entity.confidence.toFixed(2)})`;
				if (props) line += ` | ${props}`;

				const related = await queryRelated(entity.name, 1);
				if (related.length > 0) {
					const relStr = related
						.slice(0, 5)
						.map(
							(r: { direction: string; relationType: string; entity: { name: string } }) =>
								`${r.direction === "outgoing" ? "→" : "←"} ${r.relationType} ${r.entity.name}`,
						)
						.join(", ");
					line += `\n  Related: ${relStr}`;
				}

				results.push(line);
			}

			return results.join("\n\n");
		} catch (err) {
			return `Knowledge query failed: ${err instanceof Error ? err.message : String(err)}`;
		}
	},
	tags: ["knowledge", "graph", "search", "entities", "facts"],
};
