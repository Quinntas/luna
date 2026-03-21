import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tools = sqliteTable("tools", {
	name: text().primaryKey(),
	description: text().notNull(),
	schemaJson: text("schema_json").notNull(),
	tags: text({ mode: "json" }).$type<string[]>().notNull(),
	createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const userPreferences = sqliteTable("user_preferences", {
	id: text().primaryKey().default("user"),
	preferences: text({ mode: "json" }).$type<Record<string, unknown>>().notNull(),
	styleSignals: text("style_signals", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
	updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const ingestionLog = sqliteTable("ingestion_log", {
	id: integer().primaryKey({ autoIncrement: true }),
	sourceType: text("source_type").notNull(),
	sourceRef: text("source_ref").notNull(),
	entitiesCreated: integer("entities_created").notNull(),
	entitiesMerged: integer("entities_merged").notNull(),
	relationsCreated: integer("relations_created").notNull(),
	durationMs: integer("duration_ms").notNull(),
	createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});
