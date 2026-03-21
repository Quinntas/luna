import { knowledgeExtractionPrompt } from "@luna/prompts";
import { generateObject, type LanguageModel } from "ai";
import { type ExtractionOutputSchema, extractionOutputSchema } from "./schemas.ts";

export async function extractFromText(
	text: string,
	model: LanguageModel,
): Promise<ExtractionOutputSchema> {
	const { object } = await generateObject({
		model,
		schema: extractionOutputSchema,
		maxRetries: 3,
		prompt: knowledgeExtractionPrompt(text),
	});

	return object;
}
