import { intentClassificationPrompt } from "@luna/prompts";
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import type { MoodEvent, MoodLabel, MoodState } from "./types.ts";

export const BASELINE_MOOD: MoodState = {
	label: "neutral",
	intensity: 0.3,
	energy: 0.5,
	valence: 0,
	since: new Date().toISOString(),
};

const MOOD_STATES = new Map<string, MoodState>();

export function getMood(agentId: string): MoodState {
	return MOOD_STATES.get(agentId) ?? { ...BASELINE_MOOD };
}

export function setMood(agentId: string, mood: MoodState): void {
	MOOD_STATES.set(agentId, mood);
}

const DECAY_HALF_LIFE_MS = 30 * 60 * 1000;

const TRANSITIONS: Record<
	string,
	{ target: MoodLabel; intensity: number; energy: number; valence: number }
> = {
	user_praise: { target: "happy", intensity: 0.3, energy: 0.1, valence: 0.4 },
	user_criticism: { target: "frustrated", intensity: 0.3, energy: -0.1, valence: -0.3 },
	user_gratitude: { target: "content", intensity: 0.2, energy: 0, valence: 0.3 },
	user_frustration: { target: "anxious", intensity: 0.3, energy: 0.1, valence: -0.2 },
	user_humor: { target: "playful", intensity: 0.2, energy: 0.2, valence: 0.3 },
	task_success: { target: "happy", intensity: 0.2, energy: 0.1, valence: 0.3 },
	task_failure: { target: "frustrated", intensity: 0.3, energy: -0.2, valence: -0.3 },
	topic_interesting: { target: "curious", intensity: 0.2, energy: 0.2, valence: 0.1 },
	topic_boring: { target: "bored", intensity: 0.2, energy: -0.1, valence: -0.1 },
	new_conversation: { target: "neutral", intensity: 0, energy: 0, valence: 0 },
};

function clamp(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

export function decayTowardBaseline(current: MoodState, elapsedMs: number): MoodState {
	const decayFactor = Math.exp(-elapsedMs / DECAY_HALF_LIFE_MS);
	const newIntensity = lerp(BASELINE_MOOD.intensity, current.intensity, decayFactor);
	return {
		...current,
		intensity: newIntensity,
		energy: lerp(BASELINE_MOOD.energy, current.energy, decayFactor),
		valence: lerp(BASELINE_MOOD.valence, current.valence, decayFactor),
		label: newIntensity < 0.15 ? "neutral" : current.label,
	};
}

export function applyMoodEvent(current: MoodState, event: MoodEvent): MoodState {
	const rule = TRANSITIONS[event.type];
	if (!rule) {
		return { ...current, label: "neutral", since: new Date().toISOString() };
	}

	return {
		label: rule.target,
		intensity: clamp(current.intensity + rule.intensity, 0, 1),
		energy: clamp(current.energy + rule.energy, 0, 1),
		valence: clamp(current.valence + rule.valence, -1, 1),
		since: new Date().toISOString(),
		trigger: event.type,
	};
}

const intentSchema = z.object({
	sentiment: z.enum(["positive", "negative", "neutral"]),
	intent: z.enum([
		"praise",
		"criticism",
		"gratitude",
		"frustration",
		"humor",
		"question",
		"request",
		"statement",
	]),
});

const INTENT_TO_EVENT: Record<string, MoodEvent["type"]> = {
	praise: "user_praise",
	criticism: "user_criticism",
	gratitude: "user_gratitude",
	frustration: "user_frustration",
	humor: "user_humor",
};

export async function classifyUserMessage(
	message: string,
	model: LanguageModel,
): Promise<MoodEvent> {
	try {
		const result = await generateObject({
			model,
			schema: intentSchema,
			maxRetries: 2,
			prompt: intentClassificationPrompt(message),
		});

		const intent = (result.object as { intent: string }).intent;
		const eventType = INTENT_TO_EVENT[intent];
		if (eventType) return { type: eventType };
		return { type: "topic_interesting" };
	} catch {
		return { type: "topic_interesting" };
	}
}

export function processMood(agentId: string, event: MoodEvent): MoodState {
	const current = getMood(agentId);
	const elapsed = Date.now() - new Date(current.since).getTime();
	const decayed = decayTowardBaseline(current, elapsed);
	const newMood = applyMoodEvent(decayed, event);
	setMood(agentId, newMood);
	return newMood;
}
