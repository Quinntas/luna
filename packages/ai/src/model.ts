import type { LanguageModel } from "ai";
import { createGeminiModel } from "./providers/gemini.ts";
import { createLiteLLMModel } from "./providers/litellm.ts";
import { aiEnvSchema, type Provider } from "./types.ts";

let _model: LanguageModel | null = null;

function loadAiEnv() {
	const cleaned = Object.fromEntries(
		Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]),
	);

	const result = aiEnvSchema.safeParse(cleaned);

	if (!result.success) {
		const messages = result.error.issues
			.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
			.join("\n");
		throw new Error(`Invalid AI environment variables:\n${messages}`);
	}

	return result.data;
}

function buildModel(provider: Provider, model: string): LanguageModel {
	switch (provider) {
		case "gemini": {
			const apiKey = process.env.GEMINI_API_KEY;
			if (!apiKey) {
				throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemini");
			}
			return createGeminiModel(model, apiKey);
		}

		case "litellm": {
			const url = process.env.LITELLM_URL;
			const key = process.env.LITELLM_KEY;
			if (!url || !key) {
				throw new Error("LITELLM_URL and LITELLM_KEY are required when AI_PROVIDER=litellm");
			}
			return createLiteLLMModel(model, url, key);
		}

		default:
			throw new Error(`Unknown AI provider: ${provider}`);
	}
}

export function getModel(): LanguageModel {
	if (!_model) {
		const env = loadAiEnv();
		_model = buildModel(env.AI_PROVIDER, env.AI_MODEL);
	}
	return _model;
}

export function createModel(provider: Provider, modelName: string): LanguageModel {
	return buildModel(provider, modelName);
}
