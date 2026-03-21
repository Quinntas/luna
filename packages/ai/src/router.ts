import type { LanguageModel } from "ai";

export type SensitivityLevel = "public" | "internal" | "confidential" | "restricted";

export interface RoutingConfig {
	default: LanguageModel;
	local?: LanguageModel;
	classify: (input: string) => SensitivityLevel;
}

export function createRouter(config: RoutingConfig) {
	return {
		getModel(input: string): LanguageModel {
			const level = config.classify(input);
			if ((level === "confidential" || level === "restricted") && config.local) {
				return config.local;
			}
			return config.default;
		},
	};
}
