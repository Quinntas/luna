import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { closeDb } from "./index.ts";
import { deleteThread, getThread, listThreads, putThread } from "./threads.ts";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0)) {
		const dbPath = path.join(dir, "luna.db");
		closeDb(dbPath);
		await rm(dir, { recursive: true, force: true });
	}
});

describe("thread persistence", () => {
	it("stores and reloads thread records in the shared db schema", async () => {
		const dir = await mkdtemp(path.join(os.tmpdir(), "luna-db-threads-"));
		tempDirs.push(dir);
		const dbPath = path.join(dir, "luna.db");

		putThread(
			{
				id: "thread-b",
				createdAt: "2026-01-02T00:00:00.000Z",
				updatedAt: "2026-01-02T00:00:00.000Z",
				title: "thread-b",
				repoRoot: "/repo",
				dataJson: { id: "thread-b", title: "thread-b", checkpointSequence: 2 },
			},
			dbPath,
		);
		putThread(
			{
				id: "thread-a",
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-01T00:00:00.000Z",
				title: "thread-a",
				repoRoot: "/repo",
				dataJson: { id: "thread-a", title: "thread-a", checkpointSequence: 1 },
			},
			dbPath,
		);

		expect(
			getThread<{ id: string; title: string; checkpointSequence: number }>("thread-a", dbPath),
		).toEqual({
			id: "thread-a",
			title: "thread-a",
			checkpointSequence: 1,
		});
		expect(
			listThreads<{ id: string; title: string; checkpointSequence: number }>(dbPath).map(
				(thread) => thread.id,
			),
		).toEqual(["thread-a", "thread-b"]);

		closeDb(dbPath);

		expect(
			getThread<{ id: string; title: string; checkpointSequence: number }>("thread-b", dbPath),
		).toEqual({ id: "thread-b", title: "thread-b", checkpointSequence: 2 });

		deleteThread("thread-a", dbPath);
		expect(listThreads<{ id: string }>(dbPath).map((thread) => thread.id)).toEqual(["thread-b"]);
	});
});
