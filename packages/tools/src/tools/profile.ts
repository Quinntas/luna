import { z } from "zod";
import type { ToolDefinition } from "../types.ts";

const getProfileSchema = z.object({});

const setPreferenceSchema = z.object({
	key: z.string().describe("Preference key (formality, responseLength, language, tone)"),
	value: z.string().describe("New value for the preference"),
});

type GetProfileInput = z.infer<typeof getProfileSchema>;
type SetPreferenceInput = z.infer<typeof setPreferenceSchema>;

export const getProfileTool: ToolDefinition<GetProfileInput> = {
	name: "get_profile",
	description: "Get the user's preferences and profile information.",
	schema: getProfileSchema,
	execute: async () => {
		try {
			const { getPreferences } = await import("@luna/personalize");
			const prefs = getPreferences();

			const lines = [
				`Formality: ${prefs.formality ?? "neutral"}`,
				`Response length: ${prefs.responseLength ?? "balanced"}`,
				`Language: ${prefs.language ?? "en"}`,
			];

			const tone = prefs.tone as string[] | undefined;
			if (tone && tone.length > 0) {
				lines.push(`Tone: ${tone.join(", ")}`);
			}

			const topics = prefs.topics as string[] | undefined;
			if (topics && topics.length > 0) {
				lines.push(`Topics: ${topics.join(", ")}`);
			}

			return lines.join("\n");
		} catch (err) {
			return `Failed to get profile: ${err instanceof Error ? err.message : String(err)}`;
		}
	},
	tags: ["profile", "preferences", "user", "settings"],
};

export const setPreferenceTool: ToolDefinition<SetPreferenceInput> = {
	name: "set_preference",
	description:
		"Update a user preference. Use this to remember user corrections or style adjustments.",
	schema: setPreferenceSchema,
	execute: async ({ key, value }) => {
		try {
			const { setPreferences } = await import("@luna/personalize");
			const parsedValue =
				value.startsWith("[") || value.startsWith("{") ? JSON.parse(value) : value;
			setPreferences({ [key]: parsedValue });
			return `Preference "${key}" set to "${value}"`;
		} catch (err) {
			return `Failed to set preference: ${err instanceof Error ? err.message : String(err)}`;
		}
	},
	tags: ["profile", "preferences", "settings", "update"],
};
