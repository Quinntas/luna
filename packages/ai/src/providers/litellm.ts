import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

interface LiteLLMOptions {
	tags?: string[];
	cache?: boolean;
}

export function createLiteLLMModel(
	modelName: string,
	baseURL: string,
	apiKey: string,
	options: LiteLLMOptions = {},
): LanguageModel {
	const { tags = [], cache = true } = options;

	const provider = createOpenAICompatible({
		name: modelName,
		baseURL,
		apiKey,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		fetch: ((url: string | URL | Request, init?: RequestInit) => {
			const body: Record<string, unknown> = init?.body ? JSON.parse(init.body as string) : {};

			return fetch(url, {
				...init,
				body: JSON.stringify({
					...body,
					metadata: { tags },
					cache: cache ? { "no-cache": true } : {},
				}),
			});
		}) as typeof fetch,
	});

	return provider(modelName);
}
