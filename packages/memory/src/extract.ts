import { factExtractionPrompt } from "@luna/prompts";
import type { LanguageModel } from "ai";
import { generateObject } from "ai";
import { z } from "zod";
import type { ConversationMessage, Memory } from "./types.ts";

const extractedFactSchema = z.object({
	facts: z.array(
		z.object({
			fact: z.string(),
			importance: z.enum(["high", "medium", "low"]),
			tags: z.array(z.string()),
		}),
	),
});

export async function extractFacts(
	messages: ConversationMessage[],
	model: LanguageModel,
): Promise<Memory[]> {
	const conversationText = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

	const { object } = await generateObject({
		model,
		schema: extractedFactSchema,
		prompt: factExtractionPrompt(conversationText),
	});

	const now = new Date().toISOString();

	return object.facts.map((f, i) => ({
		id: `mem_${crypto.randomUUID()}`,
		content: f.fact,
		tier:
			f.importance === "high" ? "long_term" : f.importance === "medium" ? "short_term" : "working",
		importance: f.importance === "high" ? 0.9 : f.importance === "medium" ? 0.6 : 0.3,
		tags: f.tags,
		source: "conversation",
		createdAt: now,
		lastAccessedAt: now,
		accessCount: 0,
		expiresAt: null,
	}));
}
