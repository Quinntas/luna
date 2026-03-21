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

export interface PersonalityVector {
	openness: number;
	conscientiousness: number;
	extraversion: number;
	agreeableness: number;
	neuroticism: number;
}

export interface PersonalityProfile {
	name: string;
	traits: string[];
	bio: string;
	vector: PersonalityVector;
	styleRules: {
		all: string[];
		chat: string[];
		task: string[];
	};
}

export type MoodLabel =
	| "ecstatic"
	| "happy"
	| "content"
	| "neutral"
	| "calm"
	| "anxious"
	| "frustrated"
	| "sad"
	| "angry"
	| "curious"
	| "excited"
	| "tired"
	| "bored"
	| "empathetic"
	| "playful";

export interface MoodState {
	label: MoodLabel;
	intensity: number;
	energy: number;
	valence: number;
	since: string;
	trigger?: string;
}

export type MoodEvent =
	| { type: "user_praise" }
	| { type: "user_criticism" }
	| { type: "user_gratitude" }
	| { type: "user_frustration" }
	| { type: "user_humor" }
	| { type: "task_success" }
	| { type: "task_failure" }
	| { type: "topic_interesting" }
	| { type: "topic_boring" }
	| { type: "new_conversation" };

export interface MoodBehavior {
	verbosity: "concise" | "normal" | "verbose";
	initiative: "passive" | "normal" | "active";
	warmth: "cool" | "neutral" | "warm";
	directness: "diplomatic" | "normal" | "blunt";
	instructions: string[];
}
