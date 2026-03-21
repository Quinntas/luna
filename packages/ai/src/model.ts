import { loadEnv, type Provider } from "@luna/env";
import type { LanguageModel } from "ai";
import { createGeminiModel } from "./providers/gemini.ts";
import { createLiteLLMModel } from "./providers/litellm.ts";

let _model: LanguageModel | null = null;

function buildModel(provider: Provider, model: string): LanguageModel {
	switch (provider) {
		case "gemini": {
			const env = loadEnv();
			if (!env.GEMINI_API_KEY) {
				throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemini");
			}
			return createGeminiModel(model, env.GEMINI_API_KEY);
		}

		case "litellm": {
			const env = loadEnv();
			if (!env.LITELLM_URL || !env.LITELLM_KEY) {
				throw new Error("LITELLM_URL and LITELLM_KEY are required when AI_PROVIDER=litellm");
			}
			return createLiteLLMModel(model, env.LITELLM_URL, env.LITELLM_KEY);
		}

		default:
			throw new Error(`Unknown AI provider: ${provider}`);
	}
}

export function getModel(): LanguageModel {
	if (!_model) {
		const env = loadEnv();
		_model = buildModel(env.AI_PROVIDER, env.AI_MODEL);
	}
	return _model;
}

export function createModel(provider: Provider, modelName: string): LanguageModel {
	return buildModel(provider, modelName);
}
