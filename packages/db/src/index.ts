import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema.ts";

const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS tools (
  name TEXT PRIMARY KEY NOT NULL,
  description TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY NOT NULL DEFAULT 'user',
  preferences TEXT NOT NULL DEFAULT '{}',
  style_signals TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS ingestion_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  entities_created INTEGER NOT NULL,
  entities_merged INTEGER NOT NULL,
  relations_created INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  title TEXT NOT NULL,
  repo_root TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS threads_created_at_idx ON threads(created_at);
`;

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

const dbConnections = new Map<string, { db: DbInstance; sqlite: Database }>();

function resolveDbPath(dbPath?: string): string {
	return dbPath ?? process.env.LUNA_DB_PATH ?? join(process.cwd(), "data", "luna.db");
}

export function getDb(dbPath?: string) {
	const resolvedPath = resolveDbPath(dbPath);
	const existing = dbConnections.get(resolvedPath);
	if (existing) {
		return existing.db;
	}

	{
		const dir = resolvedPath.split("/").slice(0, -1).join("/");
		if (dir) {
			mkdirSync(dir, { recursive: true });
		}
		const sqlite = new Database(resolvedPath);
		sqlite.exec("PRAGMA journal_mode = WAL");
		sqlite.exec("PRAGMA foreign_keys = ON");
		sqlite.exec(CREATE_TABLES);
		const db = drizzle({ client: sqlite, schema });
		dbConnections.set(resolvedPath, { db, sqlite });
		return db;
	}
}

export function closeDb(dbPath?: string): void {
	const resolvedPath = resolveDbPath(dbPath);
	const connection = dbConnections.get(resolvedPath);
	if (!connection) {
		return;
	}
	connection.sqlite.close();
	dbConnections.delete(resolvedPath);
}

export {
	getPreferences,
	getStyleSignals,
	resetPreferences,
	setPreferences,
	setStyleSignals,
} from "./preferences.ts";
export { ingestionLog, threads, tools, userPreferences } from "./schema.ts";
export type { ThreadRow } from "./threads.ts";
export {
	deleteThread,
	getThread,
	listThreads,
	putThread,
} from "./threads.ts";
export type { ToolRow } from "./tools.ts";
export {
	clearTools,
	getTool,
	listToolDescriptions,
	listTools,
	registerTool,
	searchTools,
	unregisterTool,
} from "./tools.ts";
