import { describe, expect, test } from "bun:test";
import { aiSchema, neo4jSchema, providerSchema } from "./schemas.ts";

describe("neo4jSchema", () => {
	test("validates correct Neo4j config", () => {
		const result = neo4jSchema.safeParse({
			NEO4J_URI: "bolt://localhost:7687",
			NEO4J_USER: "neo4j",
			NEO4J_PASSWORD: "password123",
		});
		expect(result.success).toBe(true);
	});

	test("applies defaults", () => {
		const result = neo4jSchema.safeParse({
			NEO4J_PASSWORD: "pass",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.NEO4J_URI).toBe("bolt://localhost:7687");
			expect(result.data.NEO4J_USER).toBe("neo4j");
		}
	});

	test("rejects missing password", () => {
		const result = neo4jSchema.safeParse({
			NEO4J_URI: "bolt://localhost:7687",
		});
		expect(result.success).toBe(false);
	});

	test("rejects invalid URI", () => {
		const result = neo4jSchema.safeParse({
			NEO4J_URI: "not-a-url",
			NEO4J_PASSWORD: "pass",
		});
		expect(result.success).toBe(false);
	});
});

describe("aiSchema", () => {
	test("validates correct AI config", () => {
		const result = aiSchema.safeParse({
			AI_PROVIDER: "gemini",
			AI_MODEL: "gemini-2.0-flash",
			GEMINI_API_KEY: "key123",
		});
		expect(result.success).toBe(true);
	});

	test("applies default provider", () => {
		const result = aiSchema.safeParse({
			AI_MODEL: "gemini-2.0-flash",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.AI_PROVIDER).toBe("gemini");
		}
	});

	test("rejects missing model", () => {
		const result = aiSchema.safeParse({
			AI_PROVIDER: "gemini",
		});
		expect(result.success).toBe(false);
	});

	test("validates litellm config", () => {
		const result = aiSchema.safeParse({
			AI_PROVIDER: "litellm",
			AI_MODEL: "gpt-4",
			LITELLM_URL: "http://localhost:4000",
			LITELLM_KEY: "key",
		});
		expect(result.success).toBe(true);
	});
});

describe("providerSchema", () => {
	test("accepts gemini", () => {
		expect(providerSchema.safeParse("gemini").success).toBe(true);
	});

	test("accepts litellm", () => {
		expect(providerSchema.safeParse("litellm").success).toBe(true);
	});

	test("rejects unknown provider", () => {
		expect(providerSchema.safeParse("openai").success).toBe(false);
	});
});
