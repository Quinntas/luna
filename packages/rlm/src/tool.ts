import { type LanguageModel, tool } from "ai";
import { z } from "zod";
import { rlmComplete } from "./rlm.ts";
import type { RLMConfig } from "./types.ts";

export function createRLMTool(model: LanguageModel, options: Partial<RLMConfig> = {}) {
	return tool({
		description:
			"Process extremely long text using recursive language model decomposition. " +
			"Use this for tasks that require reasoning over large documents, codebases, or datasets " +
			"that exceed typical context windows. The tool chunks the input and recursively queries " +
			"sub-LLMs to build up a comprehensive answer.",
		parameters: z.object({
			context: z.string().describe("The long text or context to process"),
			query: z.string().describe("The question or instruction about the context"),
		}),
		execute: async ({ context, query }) => {
			const result = await rlmComplete(context, query, { model, ...options });
			return result.answer;
		},
	});
}
