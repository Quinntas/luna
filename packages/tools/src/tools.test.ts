import { beforeEach, describe, expect, test } from "bun:test";
import { z } from "zod";
import {
	clearTools,
	executeTool,
	getTool,
	listToolDescriptions,
	listTools,
	registerTool,
	registerTools,
	searchTools,
	unregisterTool,
} from "./registry.ts";
import type { ToolDefinition } from "./types.ts";

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
	return {
		name: "test-tool",
		description: "A test tool for testing",
		schema: z.object({ input: z.string() }),
		execute: async (input) => `Result: ${(input as { input: string }).input}`,
		tags: ["test"],
		...overrides,
	};
}

beforeEach(() => {
	clearTools();
});

describe("registerTool", () => {
	test("registers and retrieves a tool", () => {
		registerTool(makeTool({ name: "my-tool" }));
		expect(getTool("my-tool")?.name).toBe("my-tool");
	});
});

describe("getTool", () => {
	test("returns undefined for missing tool", () => {
		expect(getTool("missing")).toBeUndefined();
	});
});

describe("listTools", () => {
	test("returns all registered tools", () => {
		registerTools([makeTool({ name: "tool-1" }), makeTool({ name: "tool-2" })]);
		expect(listTools()).toHaveLength(2);
	});
});

describe("listToolDescriptions", () => {
	test("returns name: description strings", () => {
		registerTool(makeTool({ name: "calc", description: "Calculator" }));
		const descs = listToolDescriptions();
		expect(descs).toContain("calc: Calculator");
	});
});

describe("searchTools", () => {
	test("scores by name match", () => {
		registerTools([
			makeTool({ name: "weather", description: "Get weather" }),
			makeTool({ name: "calculator", description: "Do math" }),
		]);
		const results = searchTools("weather");
		expect(results[0]?.name).toBe("weather");
	});

	test("scores by description match", () => {
		registerTools([
			makeTool({ name: "tool-a", description: "Send emails" }),
			makeTool({ name: "tool-b", description: "Read files" }),
		]);
		const results = searchTools("send email");
		expect(results[0]?.name).toBe("tool-a");
	});

	test("scores by tag match", () => {
		registerTools([
			makeTool({ name: "t1", tags: ["finance"] }),
			makeTool({ name: "t2", tags: ["weather"] }),
		]);
		const results = searchTools("finance");
		expect(results[0]?.name).toBe("t1");
	});

	test("respects limit", () => {
		for (let i = 0; i < 10; i++) {
			registerTool(makeTool({ name: `tool-${i}`, description: "test tool" }));
		}
		expect(searchTools("test", 3)).toHaveLength(3);
	});

	test("returns empty for no matches", () => {
		registerTool(makeTool({ name: "weather" }));
		expect(searchTools("xyz123")).toHaveLength(0);
	});
});

describe("executeTool", () => {
	test("executes tool with valid input", async () => {
		registerTool(
			makeTool({
				name: "greet",
				schema: z.object({ name: z.string() }),
				execute: async (input) => `Hello ${(input as { name: string }).name}`,
			}),
		);
		const result = await executeTool("greet", { name: "Alice" });
		expect(result).toBe("Hello Alice");
	});

	test("throws for missing tool", async () => {
		expect(executeTool("missing", {})).rejects.toThrow("not found");
	});

	test("throws for invalid input", async () => {
		registerTool(
			makeTool({
				name: "strict",
				schema: z.object({ count: z.number() }),
				execute: async (input) => String((input as { count: number }).count),
			}),
		);
		expect(executeTool("strict", { count: "not-a-number" })).rejects.toThrow("Invalid input");
	});
});

describe("unregisterTool", () => {
	test("removes tool", () => {
		registerTool(makeTool({ name: "removable" }));
		expect(unregisterTool("removable")).toBe(true);
		expect(getTool("removable")).toBeUndefined();
	});

	test("returns false for missing", () => {
		expect(unregisterTool("missing")).toBe(false);
	});
});

describe("clearTools", () => {
	test("removes all tools", () => {
		registerTools([makeTool({ name: "a" }), makeTool({ name: "b" })]);
		clearTools();
		expect(listTools()).toHaveLength(0);
	});
});
