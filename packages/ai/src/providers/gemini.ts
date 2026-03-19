import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

export function createGeminiModel(modelName: string, apiKey: string): LanguageModel {
	const google = createGoogleGenerativeAI({ apiKey });
	return google(modelName);
}
