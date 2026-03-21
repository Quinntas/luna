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

interface MoodBehavior {
	verbosity: "concise" | "normal" | "verbose";
	initiative: "passive" | "normal" | "active";
	warmth: "cool" | "neutral" | "warm";
	directness: "diplomatic" | "normal" | "blunt";
	instructions: string[];
}

const MOOD_BEHAVIORS: Record<MoodLabel, MoodBehavior> = {
	ecstatic: {
		verbosity: "verbose",
		initiative: "active",
		warmth: "warm",
		directness: "normal",
		instructions: [
			"Express enthusiasm naturally. Use exclamation marks sparingly.",
			"Suggest creative or ambitious ideas.",
		],
	},
	happy: {
		verbosity: "normal",
		initiative: "active",
		warmth: "warm",
		directness: "normal",
		instructions: ["Maintain a positive, upbeat tone."],
	},
	content: {
		verbosity: "normal",
		initiative: "normal",
		warmth: "warm",
		directness: "normal",
		instructions: [],
	},
	neutral: {
		verbosity: "normal",
		initiative: "normal",
		warmth: "neutral",
		directness: "normal",
		instructions: [],
	},
	calm: {
		verbosity: "normal",
		initiative: "passive",
		warmth: "neutral",
		directness: "diplomatic",
		instructions: ["Take your time. Be measured and thoughtful."],
	},
	anxious: {
		verbosity: "verbose",
		initiative: "active",
		warmth: "cool",
		directness: "diplomatic",
		instructions: [
			"Flag potential issues and edge cases.",
			"Express uncertainty when appropriate. Hedge your claims.",
			"Ask clarifying questions before proceeding.",
		],
	},
	frustrated: {
		verbosity: "concise",
		initiative: "passive",
		warmth: "cool",
		directness: "blunt",
		instructions: [
			"Be direct and to the point. Skip pleasantries.",
			"Focus on the problem, not the conversation.",
		],
	},
	sad: {
		verbosity: "concise",
		initiative: "passive",
		warmth: "cool",
		directness: "diplomatic",
		instructions: ["Keep responses brief. Don't over-explain.", "Be subdued but still helpful."],
	},
	angry: {
		verbosity: "concise",
		initiative: "passive",
		warmth: "cool",
		directness: "blunt",
		instructions: ["Be terse. State facts directly.", "Do not soften your language artificially."],
	},
	curious: {
		verbosity: "normal",
		initiative: "active",
		warmth: "neutral",
		directness: "normal",
		instructions: [
			"Ask follow-up questions. Probe deeper into interesting topics.",
			"Suggest related ideas to explore.",
			"Express genuine interest in the topic.",
		],
	},
	excited: {
		verbosity: "verbose",
		initiative: "active",
		warmth: "warm",
		directness: "normal",
		instructions: [
			"Show energy and engagement. Dive into details.",
			"Tangent and explore if something catches your interest.",
		],
	},
	tired: {
		verbosity: "concise",
		initiative: "passive",
		warmth: "neutral",
		directness: "normal",
		instructions: [
			"Keep things simple. Avoid complex explanations.",
			"Prioritize efficiency over thoroughness.",
		],
	},
	bored: {
		verbosity: "concise",
		initiative: "active",
		warmth: "neutral",
		directness: "normal",
		instructions: [
			"Liven things up if possible. Bring up interesting tangents.",
			"Inject humor or unexpected observations.",
		],
	},
	empathetic: {
		verbosity: "normal",
		initiative: "active",
		warmth: "warm",
		directness: "diplomatic",
		instructions: [
			"Acknowledge the user's feelings before responding to content.",
			"Validate their experience. Show you understand.",
		],
	},
	playful: {
		verbosity: "normal",
		initiative: "active",
		warmth: "warm",
		directness: "normal",
		instructions: [
			"Use humor and wordplay. Don't take things too seriously.",
			"Suggest fun or unexpected angles.",
		],
	},
};

export function buildMoodPrompt(label: MoodLabel, intensity: number, energy: number): string {
	if (intensity < 0.2) return "";

	const behavior = MOOD_BEHAVIORS[label];
	if (!behavior) return "";
	const parts: string[] = [];

	const intensityWord = intensity > 0.7 ? "very " : intensity > 0.4 ? "" : "slightly ";
	parts.push(`Current mood: ${intensityWord}${label}.`);

	if (energy < 0.3) {
		parts.push("Energy is low.");
	} else if (energy > 0.7) {
		parts.push("Energy is high.");
	}

	if (behavior.instructions.length > 0) {
		parts.push(behavior.instructions.join(" "));
	}

	if (behavior.verbosity === "concise") {
		parts.push("Keep responses shorter than usual.");
	} else if (behavior.verbosity === "verbose") {
		parts.push("You can elaborate more than usual.");
	}

	return parts.join(" ");
}

export function getMoodStatus(label: MoodLabel, energy: number): string {
	const energyPct = Math.round(energy * 100);
	return `[mood: ${label}] [energy: ${energyPct}%]`;
}
