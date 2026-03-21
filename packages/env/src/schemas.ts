import { z } from "zod";

export const neo4jSchema = z.object({
	NEO4J_URI: z.string().url().default("bolt://localhost:7687"),
	NEO4J_USER: z.string().default("neo4j"),
	NEO4J_PASSWORD: z.string().min(1, "NEO4J_PASSWORD is required"),
});

export const providerSchema = z.enum(["gemini", "litellm"]);
export type Provider = z.infer<typeof providerSchema>;

export const aiSchema = z.object({
	AI_PROVIDER: providerSchema.default("gemini"),
	AI_MODEL: z.string().min(1, "AI_MODEL is required"),
	GEMINI_API_KEY: z.string().optional(),
	LITELLM_URL: z.string().url().optional(),
	LITELLM_KEY: z.string().optional(),
});

export const envSchema = neo4jSchema.merge(aiSchema);
export type Env = z.infer<typeof envSchema>;
