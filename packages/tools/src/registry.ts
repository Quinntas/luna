import {
	clearTools as dbClearTools,
	getTool as dbGetTool,
	listTools as dbListTools,
	registerTool as dbRegisterTool,
	searchTools as dbSearchTools,
	unregisterTool as dbUnregisterTool,
} from "@luna/db";
import type { z } from "zod";
import type { ToolDefinition } from "./types.ts";

const executors = new Map<string, ToolDefinition>();

export function registerTool<T>(tool: ToolDefinition<T>): void {
	dbRegisterTool({
		name: tool.name,
		description: tool.description,
		schemaJson: JSON.stringify(tool.schema),
		tags: tool.tags ?? [],
	});
	executors.set(tool.name, tool as ToolDefinition);
}

export function registerTools(toolList: ToolDefinition[]): void {
	for (const tool of toolList) {
		registerTool(tool);
	}
}

export function getTool(name: string): ToolDefinition | undefined {
	return executors.get(name);
}

export function listTools(): ToolDefinition[] {
	return [...executors.values()];
}

export function listToolDescriptions(): string[] {
	return dbListTools().map((t) => `${t.name}: ${t.description}`);
}

export function searchTools(query: string, limit = 5): ToolDefinition[] {
	const dbResults = dbSearchTools(query, limit);
	return dbResults
		.map((r) => executors.get(r.name))
		.filter((t): t is ToolDefinition => t !== undefined);
}

export async function executeTool(name: string, input: unknown): Promise<string> {
	const tool = executors.get(name);
	if (!tool) throw new Error(`Tool "${name}" not found`);

	const parsed = tool.schema.safeParse(input);
	if (!parsed.success) {
		throw new Error(`Invalid input for tool "${name}": ${parsed.error.message}`);
	}

	return tool.execute(parsed.data);
}

export function unregisterTool(name: string): boolean {
	executors.delete(name);
	return dbUnregisterTool(name);
}

export function clearTools(): void {
	executors.clear();
	dbClearTools();
}
