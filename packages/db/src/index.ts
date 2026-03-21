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
`;

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
	if (!_db) {
		const dbPath = process.env.LUNA_DB_PATH ?? join(process.cwd(), "data", "luna.db");
		const dir = dbPath.split("/").slice(0, -1).join("/");
		if (dir) {
			mkdirSync(dir, { recursive: true });
		}
		const sqlite = new Database(dbPath);
		sqlite.exec("PRAGMA journal_mode = WAL");
		sqlite.exec("PRAGMA foreign_keys = ON");
		sqlite.exec(CREATE_TABLES);
		_db = drizzle({ client: sqlite, schema });
	}
	return _db;
}

export {
	getPreferences,
	getStyleSignals,
	resetPreferences,
	setPreferences,
	setStyleSignals,
} from "./preferences.ts";
export { ingestionLog, tools, userPreferences } from "./schema.ts";
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
