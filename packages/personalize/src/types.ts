export type Formality = "casual" | "neutral" | "formal";
export type ResponseLength = "concise" | "balanced" | "detailed";

export interface UserPreferences {
	formality: Formality;
	responseLength: ResponseLength;
	language: string;
	topics: string[];
	tone: string[];
}

export interface UserProfile {
	id: string;
	preferences: UserPreferences;
	styleSignals: {
		avgSentenceLength: number;
		usesEmoji: boolean;
		usesMarkdown: boolean;
		commonPhrases: string[];
	};
	updatedAt: string;
}
