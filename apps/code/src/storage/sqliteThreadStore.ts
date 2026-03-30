import { closeDb, deleteThread, getThread, listThreads, putThread } from "@luna/db";
import { LunaStorageError } from "../contracts/errors";
import type { LunaThreadId } from "../contracts/ids";
import type { ThreadStore } from "../contracts/ports";
import type { LunaThreadRecord } from "../contracts/thread";

export interface SqliteThreadStoreOptions {
	readonly dbPath?: string;
}

export class SqliteThreadStore implements ThreadStore {
	private readonly dbPath: string | undefined;

	constructor(options: SqliteThreadStoreOptions = {}) {
		this.dbPath = options.dbPath;
	}

	async getThread(threadId: LunaThreadId): Promise<LunaThreadRecord | null> {
		try {
			return getThread<LunaThreadRecord>(threadId, this.dbPath) ?? null;
		} catch (error) {
			throw new LunaStorageError("Failed to read thread from SQLite.", { cause: error });
		}
	}

	async putThread(thread: LunaThreadRecord): Promise<void> {
		try {
			putThread(
				{
					id: thread.id,
					createdAt: thread.createdAt,
					updatedAt: thread.updatedAt,
					title: thread.title,
					repoRoot: thread.repoRoot,
					dataJson: thread,
				},
				this.dbPath,
			);
		} catch (error) {
			throw new LunaStorageError("Failed to write thread to SQLite.", { cause: error });
		}
	}

	async deleteThread(threadId: LunaThreadId): Promise<void> {
		try {
			deleteThread(threadId, this.dbPath);
		} catch (error) {
			throw new LunaStorageError("Failed to delete thread from SQLite.", { cause: error });
		}
	}

	async listThreads(): Promise<readonly LunaThreadRecord[]> {
		try {
			return listThreads<LunaThreadRecord>(this.dbPath);
		} catch (error) {
			throw new LunaStorageError("Failed to list threads from SQLite.", { cause: error });
		}
	}

	close(): void {
		closeDb(this.dbPath);
	}
}
