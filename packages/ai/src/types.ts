import { z } from "zod";

export const providerSchema = z.enum(["gemini", "litellm"]);
export type Provider = z.infer<typeof providerSchema>;

export const aiEnvSchema = z.object({
	AI_PROVIDER: providerSchema.default("gemini"),
	AI_MODEL: z.string().min(1, "AI_MODEL is required"),
	GEMINI_API_KEY: z.string().optional(),
	LITELLM_URL: z.string().url().optional(),
	LITELLM_KEY: z.string().optional(),
});

export type AiEnv = z.infer<typeof aiEnvSchema>;
