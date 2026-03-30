import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { LunaThreadId } from "../contracts/ids";
import type { ThreadStore } from "../contracts/ports";
import type { LunaThreadRecord } from "../contracts/thread";
import { LunaStorageError } from "../contracts/errors";

export interface SqliteThreadStoreOptions {
  readonly filePath: string;
}

interface ThreadRow {
  id: string;
  created_at: string;
  data: string;
}

interface SqliteDatabase {
  exec(sql: string): void;
  query<T, TParams extends unknown[]>(
    sql: string,
  ): {
    get(...params: TParams): T | null;
    all(...params: TParams): T[];
    run(...params: unknown[]): unknown;
  };
  close(): void;
}

export class SqliteThreadStore implements ThreadStore {
  private readonly filePath: string;
  private db: SqliteDatabase | null = null;
  private operationQueue: Promise<unknown> = Promise.resolve();
  private readonly ready: Promise<void>;

  constructor(options: SqliteThreadStoreOptions) {
    this.filePath = options.filePath;
    this.ready = this.initialize();
  }

  private async initialize(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    this.db = await this.openDatabase(this.filePath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA synchronous = NORMAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        title TEXT NOT NULL,
        repo_root TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS threads_created_at_idx ON threads(created_at);
    `);
  }

  private async openDatabase(filePath: string): Promise<SqliteDatabase> {
    try {
      const bunSpecifier = "bun:sqlite";
      const bunSqlite = (await import(bunSpecifier)) as {
        Database: new (
          path: string,
          options: { create: boolean; strict: boolean },
        ) => SqliteDatabase;
      };
      return new bunSqlite.Database(filePath, { create: true, strict: true });
    } catch {
      const nodeSpecifier = "node:sqlite";
      const nodeSqlite = (await import(nodeSpecifier)) as {
        DatabaseSync: new (path: string) => {
          exec(sql: string): void;
          prepare(sql: string): {
            get(...params: unknown[]): unknown;
            all(...params: unknown[]): unknown[];
            run(...params: unknown[]): unknown;
          };
          close(): void;
        };
      };
      const database = new nodeSqlite.DatabaseSync(filePath);
      return {
        exec(sql: string) {
          database.exec(sql);
        },
        query<T, TParams extends unknown[]>(sql: string) {
          const statement = database.prepare(sql);
          return {
            get(...params: TParams) {
              return (statement.get(...params) as T | undefined) ?? null;
            },
            all(...params: TParams) {
              return statement.all(...params) as T[];
            },
            run(...params: unknown[]) {
              return statement.run(...params);
            },
          };
        },
        close() {
          database.close();
        },
      };
    }
  }

  private getDatabase() {
    if (!this.db) {
      throw new LunaStorageError("SQLite database is not initialized.");
    }
    return this.db;
  }

  private async withLock<T>(operation: () => T | Promise<T>): Promise<T> {
    const run = this.operationQueue.then(
      async () => {
        await this.ready;
        return operation();
      },
      async () => {
        await this.ready;
        return operation();
      },
    );
    this.operationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private parseThreadRow(row: ThreadRow | null | undefined): LunaThreadRecord | null {
    if (!row) {
      return null;
    }

    try {
      return JSON.parse(row.data) as LunaThreadRecord;
    } catch (error) {
      throw new LunaStorageError("Failed to parse thread row from SQLite.", { cause: error });
    }
  }

  async getThread(threadId: LunaThreadId): Promise<LunaThreadRecord | null> {
    return this.withLock(() => {
      try {
        const row = this.getDatabase()
          .query<ThreadRow, [string]>("SELECT id, created_at, data FROM threads WHERE id = ?1")
          .get(threadId);
        return this.parseThreadRow(row);
      } catch (error) {
        throw new LunaStorageError("Failed to read thread from SQLite.", { cause: error });
      }
    });
  }

  async putThread(thread: LunaThreadRecord): Promise<void> {
    await this.withLock(() => {
      try {
        this.getDatabase()
          .query(
            `INSERT INTO threads (id, created_at, updated_at, title, repo_root, data)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
               created_at = excluded.created_at,
               updated_at = excluded.updated_at,
               title = excluded.title,
               repo_root = excluded.repo_root,
               data = excluded.data`,
          )
          .run(
            thread.id,
            thread.createdAt,
            thread.updatedAt,
            thread.title,
            thread.repoRoot,
            JSON.stringify(thread),
          );
      } catch (error) {
        throw new LunaStorageError("Failed to write thread to SQLite.", { cause: error });
      }
    });
  }

  async deleteThread(threadId: LunaThreadId): Promise<void> {
    await this.withLock(() => {
      try {
        this.getDatabase().query("DELETE FROM threads WHERE id = ?1").run(threadId);
      } catch (error) {
        throw new LunaStorageError("Failed to delete thread from SQLite.", { cause: error });
      }
    });
  }

  async listThreads(): Promise<readonly LunaThreadRecord[]> {
    return this.withLock(() => {
      try {
        const rows = this.getDatabase()
          .query<ThreadRow, []>("SELECT id, created_at, data FROM threads ORDER BY created_at ASC")
          .all();
        return rows
          .map((row) => this.parseThreadRow(row))
          .filter((thread): thread is LunaThreadRecord => thread !== null);
      } catch (error) {
        throw new LunaStorageError("Failed to list threads from SQLite.", { cause: error });
      }
    });
  }

  close(): void {
    this.db?.close();
  }
}
