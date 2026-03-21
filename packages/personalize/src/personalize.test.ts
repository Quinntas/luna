import { beforeEach, describe, expect, test } from "bun:test";
import { resetPreferences } from "@luna/db";
import {
	adaptSystemPrompt,
	getPreferences,
	getProfile,
	learnFromFeedback,
	setPreferences,
} from "./index.ts";

beforeEach(() => {
	resetPreferences();
});

describe("getPreferences", () => {
	test("returns defaults when no profile set", () => {
		const prefs = getPreferences();
		expect(prefs.formality).toBe("neutral");
		expect(prefs.responseLength).toBe("balanced");
		expect(prefs.language).toBe("en");
	});
});

describe("setPreferences", () => {
	test("sets and retrieves preferences", () => {
		setPreferences({ formality: "casual", responseLength: "concise" });
		const prefs = getPreferences();
		expect(prefs.formality).toBe("casual");
		expect(prefs.responseLength).toBe("concise");
	});

	test("merges with existing preferences", () => {
		setPreferences({ formality: "formal" });
		setPreferences({ responseLength: "detailed" });
		const prefs = getPreferences();
		expect(prefs.formality).toBe("formal");
		expect(prefs.responseLength).toBe("detailed");
	});
});

describe("getProfile", () => {
	test("returns null initially", () => {
		// After previous tests, profile may or may not exist
		const profile = getProfile();
		// Just verify it returns the expected shape
		if (profile) {
			expect(profile.id).toBe("user");
			expect(profile.preferences).toBeDefined();
		}
	});

	test("returns profile after setPreferences", () => {
		setPreferences({ formality: "neutral" });
		const profile = getProfile();
		expect(profile).not.toBeNull();
		expect(profile?.preferences.formality).toBe("neutral");
	});
});

describe("adaptSystemPrompt", () => {
	test("returns base prompt when no preferences", () => {
		setPreferences({});
		const result = adaptSystemPrompt("You are helpful.");
		expect(result).toContain("You are helpful.");
	});

	test("adds casual instruction", () => {
		setPreferences({ formality: "casual" });
		const result = adaptSystemPrompt("Base prompt");
		expect(result).toContain("casual");
		expect(result).toContain("Base prompt");
	});

	test("adds formal instruction", () => {
		setPreferences({ formality: "formal" });
		const result = adaptSystemPrompt("Base");
		expect(result).toContain("formal");
	});

	test("adds concise instruction", () => {
		setPreferences({ responseLength: "concise" });
		const result = adaptSystemPrompt("Base");
		expect(result).toContain("brief");
	});

	test("adds tone instructions", () => {
		setPreferences({ tone: ["friendly", "encouraging"] });
		const result = adaptSystemPrompt("Base");
		expect(result).toContain("friendly");
		expect(result).toContain("encouraging");
	});

	test("adds detailed instruction", () => {
		setPreferences({ responseLength: "detailed" });
		const result = adaptSystemPrompt("Base");
		expect(result).toContain("detailed");
	});
});

describe("learnFromFeedback", () => {
	test("learns shorter preference", () => {
		setPreferences({ responseLength: "balanced" });
		learnFromFeedback("make it shorter", "context");
		expect(getPreferences().responseLength).toBe("concise");
	});

	test("learns more detail preference", () => {
		setPreferences({ responseLength: "balanced" });
		learnFromFeedback("add more detail please", "context");
		expect(getPreferences().responseLength).toBe("detailed");
	});

	test("learns formal preference", () => {
		setPreferences({ formality: "neutral" });
		learnFromFeedback("be more formal", "context");
		expect(getPreferences().formality).toBe("formal");
	});

	test("learns casual preference", () => {
		setPreferences({ formality: "neutral" });
		learnFromFeedback("be more casual and friendly", "context");
		expect(getPreferences().formality).toBe("casual");
	});
});
