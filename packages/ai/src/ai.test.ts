import { describe, expect, test } from "bun:test";
import type { LanguageModel } from "ai";
import { createRouter } from "./router.ts";

function mockModel(name: string): LanguageModel {
	return { modelId: name, provider: "mock" } as unknown as LanguageModel;
}

describe("createRouter", () => {
	test("returns default model for public input", () => {
		const defaultModel = mockModel("cloud");
		const localModel = mockModel("local");
		const router = createRouter({
			default: defaultModel,
			local: localModel,
			classify: () => "public",
		});
		const result = router.getModel("What is the weather?");
		expect(result).toBe(defaultModel);
	});

	test("returns default for internal input", () => {
		const defaultModel = mockModel("cloud");
		const localModel = mockModel("local");
		const router = createRouter({
			default: defaultModel,
			local: localModel,
			classify: () => "internal",
		});
		const result = router.getModel("Meeting notes");
		expect(result).toBe(defaultModel);
	});

	test("returns local for confidential input", () => {
		const defaultModel = mockModel("cloud");
		const localModel = mockModel("local");
		const router = createRouter({
			default: defaultModel,
			local: localModel,
			classify: () => "confidential",
		});
		const result = router.getModel("My salary info");
		expect(result).toBe(localModel);
	});

	test("returns local for restricted input", () => {
		const defaultModel = mockModel("cloud");
		const localModel = mockModel("local");
		const router = createRouter({
			default: defaultModel,
			local: localModel,
			classify: () => "restricted",
		});
		const result = router.getModel("My health records");
		expect(result).toBe(localModel);
	});

	test("falls back to default when no local model", () => {
		const defaultModel = mockModel("cloud");
		const router = createRouter({
			default: defaultModel,
			classify: () => "restricted",
		});
		const result = router.getModel("Sensitive data");
		expect(result).toBe(defaultModel);
	});
});
