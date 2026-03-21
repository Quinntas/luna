import { eq } from "drizzle-orm";
import { getDb } from "./index.ts";
import { tools } from "./schema.ts";

export interface ToolRow {
	name: string;
	description: string;
	schemaJson: string;
	tags: string[];
	createdAt: string | null;
}

export function registerTool(tool: Omit<ToolRow, "createdAt">): void {
	const db = getDb();
	db.insert(tools)
		.values(tool)
		.onConflictDoUpdate({
			target: tools.name,
			set: { description: tool.description, schemaJson: tool.schemaJson, tags: tool.tags },
		})
		.run();
}

export function getTool(name: string): ToolRow | undefined {
	const db = getDb();
	const row = db.select().from(tools).where(eq(tools.name, name)).get();
	if (!row) return undefined;
	return { ...row, tags: row.tags ?? [], createdAt: row.createdAt ?? null } as ToolRow;
}

export function listTools(): ToolRow[] {
	const db = getDb();
	return db
		.select()
		.from(tools)
		.orderBy(tools.name)
		.all()
		.map((r) => ({ ...r, tags: r.tags ?? [], createdAt: r.createdAt ?? null })) as ToolRow[];
}

export function listToolDescriptions(): string[] {
	return listTools().map((t) => `${t.name}: ${t.description}`);
}

export function searchTools(query: string, limit = 5): ToolRow[] {
	const all = listTools();
	const queryLower = query.toLowerCase();

	const scored = all.map((tool) => {
		let score = 0;
		if (tool.name.toLowerCase().includes(queryLower)) score += 2;
		if (tool.description.toLowerCase().includes(queryLower)) score += 1;
		for (const tag of tool.tags) {
			if (tag.toLowerCase().includes(queryLower)) score += 1.5;
		}
		return { tool, score };
	});

	return scored
		.filter((s) => s.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map((s) => s.tool);
}

export function unregisterTool(name: string): boolean {
	const db = getDb();
	const existing = getTool(name);
	if (!existing) return false;
	db.delete(tools).where(eq(tools.name, name)).run();
	return true;
}

export function clearTools(): void {
	const db = getDb();
	db.delete(tools).run();
}
