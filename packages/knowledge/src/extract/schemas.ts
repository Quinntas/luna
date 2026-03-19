import { z } from "zod";

const PREDEFINED_TYPES = [
	"Person",
	"Organization",
	"Project",
	"Event",
	"Location",
	"Concept",
	"Technology",
	"Document",
] as const;

export const extractedEntitySchema = z.object({
	name: z.string().describe("Canonical name of the entity"),
	type: z.string().describe(`One of: ${PREDEFINED_TYPES.join(", ")} or a new type if none fit`),
	aliases: z.array(z.string()).describe("Alternative names or references to this entity"),
	properties: z.record(z.unknown()).describe("Key-value facts about this entity"),
});

export const extractedRelationSchema = z.object({
	source: z.string().describe("Name of the source entity"),
	target: z.string().describe("Name of the target entity"),
	type: z
		.string()
		.describe(
			"UPPER_SNAKE_CASE relation type (e.g., WORKS_AT, MENTIONS, PART_OF, KNOWS, LOCATED_IN)",
		),
	properties: z.record(z.unknown()).describe("Properties of this relationship"),
});

export const extractionOutputSchema = z.object({
	entities: z.array(extractedEntitySchema),
	relations: z.array(extractedRelationSchema),
	summary: z.string().describe("1-2 sentence summary of the input text"),
});

export type ExtractedEntitySchema = z.infer<typeof extractedEntitySchema>;
export type ExtractedRelationSchema = z.infer<typeof extractedRelationSchema>;
export type ExtractionOutputSchema = z.infer<typeof extractionOutputSchema>;
