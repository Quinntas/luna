import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { LunaThreadRecord } from "../src/contracts/thread";
import { SqliteThreadStore } from "../src/storage/sqliteThreadStore";

const tempDirs: string[] = [];

function makeThread(id: string, createdAt: string): LunaThreadRecord {
	return {
		id,
		title: id,
		repoRoot: "/repo",
		createdAt,
		updatedAt: createdAt,
		codex: {
			providerThreadId: null,
			model: null,
			runtimeMode: "approval-required",
			sessionStatus: "idle",
			lastError: null,
		},
		workspace: {
			mode: "repo-root",
			branch: null,
			worktreePath: null,
			cwd: "/repo",
			checkpointSequence: 2,
			checkpoints: [],
		},
	};
}

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("SqliteThreadStore", () => {
	it("persists and reloads thread records", async () => {
		const dir = await mkdtemp(path.join(os.tmpdir(), "luna-sqlite-store-"));
		tempDirs.push(dir);
		const filePath = path.join(dir, "threads.sqlite");

		const store = new SqliteThreadStore({ filePath });
		await store.putThread(makeThread("thread-b", "2026-01-02T00:00:00.000Z"));
		await store.putThread(makeThread("thread-a", "2026-01-01T00:00:00.000Z"));
		store.close();

		const reloaded = new SqliteThreadStore({ filePath });
		expect((await reloaded.getThread("thread-a"))?.id).toBe("thread-a");
		expect((await reloaded.getThread("thread-a"))?.workspace.checkpointSequence).toBe(2);
		expect((await reloaded.listThreads()).map((thread) => thread.id)).toEqual([
			"thread-a",
			"thread-b",
		]);
		reloaded.close();
	});
});
