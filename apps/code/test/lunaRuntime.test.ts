import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { LunaRuntimeEvent } from "../src/contracts/events";
import type { CodexSessionRuntime, ThreadStore, WorktreeProvisioner } from "../src/contracts/ports";
import type { LunaSendMessageInput, LunaStartThreadInput } from "../src/contracts/session";
import { LunaRuntime } from "../src/runtime/lunaRuntime";
import { MemoryThreadStore } from "../src/storage/memoryThreadStore";
import { SqliteThreadStore } from "../src/storage/sqliteThreadStore";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

class FakeWorktree implements WorktreeProvisioner {
	readonly removed: Array<{ repoRoot: string; worktreePath: string; force: boolean }> = [];

	async ensureBinding(input: LunaStartThreadInput) {
		return {
			repoRoot: input.repoRoot,
			branch: "feature/test",
			worktreePath: `${input.repoRoot}/.worktrees/test`,
			cwd: `${input.repoRoot}/.worktrees/test`,
			reused: false,
		};
	}

	async removeWorktree(repoRoot: string, worktreePath: string, force = true) {
		this.removed.push({ repoRoot, worktreePath, force });
	}
}

class FakeCheckpointStore {
	readonly captured: Array<{ cwd: string; checkpointRef: string }> = [];

	readonly diffs: Array<{ cwd: string; fromCheckpointRef: string; toCheckpointRef: string }> = [];

	readonly deleted: Array<{ cwd: string; checkpointRefs: readonly string[] }> = [];

	async captureCheckpoint(input: { cwd: string; checkpointRef: string }) {
		this.captured.push(input);
	}

	async diffCheckpoints(input: {
		cwd: string;
		fromCheckpointRef: string;
		toCheckpointRef: string;
	}) {
		this.diffs.push(input);
		return `diff:${input.fromCheckpointRef}->${input.toCheckpointRef}`;
	}

	async restoreCheckpoint() {
		return true;
	}

	async deleteCheckpointRefs(input: { cwd: string; checkpointRefs: readonly string[] }) {
		this.deleted.push(input);
	}
}

class FakeCodex implements CodexSessionRuntime {
	private readonly listeners = new Set<(event: LunaRuntimeEvent) => void>();

	readonly startedSessions: Array<{
		providerThreadId?: string | null;
		threadId: string;
		cwd: string;
	}> = [];

	stoppedThreads: string[] = [];

	async startSession(input: { providerThreadId?: string | null; threadId: string; cwd: string }) {
		this.startedSessions.push(input);
		return { providerThreadId: "provider-thread-1" };
	}

	async sendMessage(input: LunaSendMessageInput) {
		for (const listener of this.listeners) {
			listener({
				eventId: "evt-0",
				timestamp: new Date().toISOString(),
				threadId: input.threadId,
				source: "codex",
				type: "turn.started",
				payload: { model: "gpt-5.3-codex", effort: "low" },
			});
			listener({
				eventId: "evt-1",
				timestamp: new Date().toISOString(),
				threadId: input.threadId,
				source: "codex",
				type: "content.delta",
				payload: { delta: "auth.ts" },
			});
			listener({
				eventId: "evt-2",
				timestamp: new Date().toISOString(),
				threadId: input.threadId,
				source: "codex",
				type: "turn.completed",
				payload: {},
			});
		}
		return { turnId: "turn-1" };
	}

	async stopSession(threadId: string) {
		this.stoppedThreads.push(threadId);
	}

	onEvent(listener: (event: LunaRuntimeEvent) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
}

class DeferredCodex implements CodexSessionRuntime {
	private readonly listeners = new Set<(event: LunaRuntimeEvent) => void>();

	async startSession() {
		return { providerThreadId: "provider-thread-1" };
	}

	async sendMessage(input: LunaSendMessageInput) {
		for (const listener of this.listeners) {
			listener({
				eventId: "evt-start",
				timestamp: new Date().toISOString(),
				threadId: input.threadId,
				source: "codex",
				type: "turn.started",
				payload: { model: "gpt-5.3-codex" },
			});
		}
		return { turnId: "turn-delayed" };
	}

	complete(threadId: string, type: "turn.completed" | "turn.aborted" = "turn.completed") {
		for (const listener of this.listeners) {
			if (type === "turn.aborted") {
				listener({
					eventId: `evt-${type}`,
					timestamp: new Date().toISOString(),
					threadId,
					source: "codex",
					type,
					payload: { reason: "stopped" },
				});
				continue;
			}

			listener({
				eventId: `evt-${type}`,
				timestamp: new Date().toISOString(),
				threadId,
				source: "codex",
				type,
				payload: {},
			});
		}
	}

	async stopSession() {}

	onEvent(listener: (event: LunaRuntimeEvent) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
}

describe("LunaRuntime", () => {
	it("starts a thread, binds a worktree, and forwards events", async () => {
		const seen: LunaRuntimeEvent[] = [];
		const checkpoints = new FakeCheckpointStore();
		const runtime = new LunaRuntime({
			store: new MemoryThreadStore() as ThreadStore,
			codex: { adapter: new FakeCodex() as unknown as any },
			worktree: {
				manager: new FakeWorktree() as unknown as any,
				checkpoints: checkpoints as unknown as any,
			},
		});
		runtime.on((event) => {
			seen.push(event);
		});

		const thread = await runtime.startThread({
			threadId: "thread-1",
			repoRoot: "/repo",
			title: "Search auth",
			worktree: { mode: "reuse-or-create" },
		});
		expect(thread.workspace.cwd).toContain(".worktrees/test");
		expect(thread.codex.providerThreadId).toBe("provider-thread-1");

		const sent = await runtime.sendMessage({ threadId: "thread-1", text: "search auth" });
		await runtime.waitForIdle("thread-1");
		expect(sent.turnId).toBe("turn-1");
		expect(seen.some((event) => event.type === "workspace.bound")).toBe(true);
		expect(seen.some((event) => event.type === "turn.started")).toBe(true);
		expect(seen.some((event) => event.type === "content.delta")).toBe(true);
		expect(seen.some((event) => event.type === "turn.completed")).toBe(true);
		expect(seen.some((event) => event.type === "checkpoint.captured")).toBe(true);
		expect(checkpoints.captured).toHaveLength(1);
		await expect(runtime.listThreadCheckpoints("thread-1")).resolves.toHaveLength(1);
		await expect(runtime.getThread("thread-1")).resolves.toMatchObject({
			workspace: { checkpointSequence: 1 },
		});
		await expect(runtime.diffThreadCheckpoints("thread-1")).rejects.toThrow(
			"does not have enough checkpoints",
		);
	});

	it("diffs the latest checkpoints after multiple turns", async () => {
		const checkpoints = new FakeCheckpointStore();
		const runtime = new LunaRuntime({
			store: new MemoryThreadStore() as ThreadStore,
			codex: { adapter: new FakeCodex() as unknown as any },
			worktree: {
				manager: new FakeWorktree() as unknown as any,
				checkpoints: checkpoints as unknown as any,
			},
		});

		await runtime.startThread({
			threadId: "thread-2",
			repoRoot: "/repo",
			title: "Search auth twice",
			worktree: { mode: "reuse-or-create" },
		});
		await runtime.sendMessage({ threadId: "thread-2", text: "search auth 1" });
		await runtime.sendMessage({ threadId: "thread-2", text: "search auth 2" });
		await runtime.waitForIdle("thread-2");

		const diff = await runtime.diffThreadCheckpoints("thread-2");
		expect(diff).toContain("diff:");
		expect(checkpoints.diffs).toHaveLength(1);
		await expect(runtime.getThread("thread-2")).resolves.toMatchObject({
			workspace: { checkpointSequence: 2 },
		});
	});

	it("restores the latest checkpoint for a worktree thread", async () => {
		const checkpoints = new FakeCheckpointStore();
		const restoreSpy = spyOn(checkpoints, "restoreCheckpoint");
		const runtime = new LunaRuntime({
			store: new MemoryThreadStore() as ThreadStore,
			codex: { adapter: new FakeCodex() as unknown as any },
			worktree: {
				manager: new FakeWorktree() as unknown as any,
				checkpoints: checkpoints as unknown as any,
			},
		});

		await runtime.startThread({
			threadId: "thread-restore",
			repoRoot: "/repo",
			title: "Search then restore",
			worktree: { mode: "reuse-or-create" },
		});
		await runtime.sendMessage({ threadId: "thread-restore", text: "search auth restore" });
		await runtime.waitForIdle("thread-restore");

		await expect(runtime.restoreThreadCheckpoint("thread-restore")).resolves.toBe(true);
		expect(restoreSpy).toHaveBeenCalledTimes(1);
	});

	it("deletes and prunes persisted checkpoints", async () => {
		const checkpoints = new FakeCheckpointStore();
		const runtime = new LunaRuntime({
			store: new MemoryThreadStore() as ThreadStore,
			codex: { adapter: new FakeCodex() as unknown as any },
			worktree: {
				manager: new FakeWorktree() as unknown as any,
				checkpoints: checkpoints as unknown as any,
			},
		});

		await runtime.startThread({
			threadId: "thread-prune",
			repoRoot: "/repo",
			title: "Search and prune",
			worktree: { mode: "reuse-or-create" },
		});
		await runtime.sendMessage({ threadId: "thread-prune", text: "search 1" });
		await runtime.sendMessage({ threadId: "thread-prune", text: "search 2" });
		await runtime.sendMessage({ threadId: "thread-prune", text: "search 3" });
		await runtime.waitForIdle("thread-prune");

		expect(await runtime.listThreadCheckpoints("thread-prune")).toHaveLength(3);
		await runtime.pruneThreadCheckpoints("thread-prune", 1);
		expect(await runtime.listThreadCheckpoints("thread-prune")).toHaveLength(1);
		expect(checkpoints.deleted).toHaveLength(1);

		await runtime.deleteThreadCheckpoints("thread-prune");
		expect(await runtime.listThreadCheckpoints("thread-prune")).toHaveLength(0);
		expect(checkpoints.deleted).toHaveLength(2);
		await expect(runtime.getThread("thread-prune")).resolves.toMatchObject({
			workspace: { checkpointSequence: 3 },
		});
	});

	it("deletes a thread and optionally removes its worktree", async () => {
		const worktree = new FakeWorktree();
		const checkpoints = new FakeCheckpointStore();
		const runtime = new LunaRuntime({
			store: new MemoryThreadStore() as ThreadStore,
			codex: { adapter: new FakeCodex() as unknown as any },
			worktree: {
				manager: worktree as unknown as any,
				checkpoints: checkpoints as unknown as any,
			},
		});

		await runtime.startThread({
			threadId: "thread-delete",
			repoRoot: "/repo",
			title: "Delete me",
			worktree: { mode: "reuse-or-create" },
		});
		await runtime.sendMessage({ threadId: "thread-delete", text: "search then delete" });
		await runtime.waitForIdle("thread-delete");

		await runtime.deleteThread("thread-delete", {
			removeWorktree: true,
			deleteCheckpoints: true,
		});

		expect(await runtime.getThread("thread-delete")).toBeNull();
		expect(worktree.removed).toHaveLength(1);
		expect(checkpoints.deleted).toHaveLength(1);
	});

	it("resumes a stored provider thread id from SqliteThreadStore", async () => {
		const dir = await mkdtemp(path.join(os.tmpdir(), "luna-runtime-"));
		tempDirs.push(dir);
		const store = new SqliteThreadStore({ filePath: path.join(dir, "threads.sqlite") });
		const codex = new FakeCodex();
		const firstRuntime = new LunaRuntime({
			store,
			codex: { adapter: codex as unknown as any },
			worktree: { manager: new FakeWorktree() as unknown as any },
		});

		await firstRuntime.startThread({
			threadId: "resume-thread",
			repoRoot: "/repo",
			title: "Resume me",
			worktree: { mode: "reuse-or-create" },
		});

		const secondCodex = new FakeCodex();
		const secondRuntime = new LunaRuntime({
			store,
			codex: { adapter: secondCodex as unknown as any },
			worktree: { manager: new FakeWorktree() as unknown as any },
		});
		await secondRuntime.startThread({
			threadId: "resume-thread",
			repoRoot: "/repo",
			title: "Resume me",
			worktree: { mode: "reuse-or-create" },
		});

		expect(
			secondCodex.startedSessions[secondCodex.startedSessions.length - 1]?.providerThreadId,
		).toBe("provider-thread-1");
		expect((await secondRuntime.getThread("resume-thread"))?.workspace.checkpointSequence).toBe(0);
	});

	it("persists pruned checkpoints across runtime restart", async () => {
		const dir = await mkdtemp(path.join(os.tmpdir(), "luna-prune-"));
		tempDirs.push(dir);
		const store = new SqliteThreadStore({ filePath: path.join(dir, "threads.sqlite") });
		const checkpoints = new FakeCheckpointStore();
		const runtime = new LunaRuntime({
			store,
			codex: { adapter: new FakeCodex() as unknown as any },
			worktree: {
				manager: new FakeWorktree() as unknown as any,
				checkpoints: checkpoints as unknown as any,
			},
		});

		await runtime.startThread({
			threadId: "restart-prune-thread",
			repoRoot: "/repo",
			title: "Prune and restart",
			worktree: { mode: "reuse-or-create" },
		});
		await runtime.sendMessage({ threadId: "restart-prune-thread", text: "search 1" });
		await runtime.sendMessage({ threadId: "restart-prune-thread", text: "search 2" });
		await runtime.waitForIdle("restart-prune-thread");
		await runtime.pruneThreadCheckpoints("restart-prune-thread", 1);

		const reloaded = new LunaRuntime({
			store,
			codex: { adapter: new FakeCodex() as unknown as any },
			worktree: {
				manager: new FakeWorktree() as unknown as any,
				checkpoints: checkpoints as unknown as any,
			},
		});

		await expect(reloaded.listThreadCheckpoints("restart-prune-thread")).resolves.toHaveLength(1);
		await expect(reloaded.getThread("restart-prune-thread")).resolves.toMatchObject({
			workspace: { checkpointSequence: 2 },
		});
	});

	it("persists deleted checkpoints across runtime restart", async () => {
		const dir = await mkdtemp(path.join(os.tmpdir(), "luna-delete-checkpoints-"));
		tempDirs.push(dir);
		const store = new SqliteThreadStore({ filePath: path.join(dir, "threads.sqlite") });
		const checkpoints = new FakeCheckpointStore();
		const runtime = new LunaRuntime({
			store,
			codex: { adapter: new FakeCodex() as unknown as any },
			worktree: {
				manager: new FakeWorktree() as unknown as any,
				checkpoints: checkpoints as unknown as any,
			},
		});

		await runtime.startThread({
			threadId: "restart-delete-thread",
			repoRoot: "/repo",
			title: "Delete and restart",
			worktree: { mode: "reuse-or-create" },
		});
		await runtime.sendMessage({ threadId: "restart-delete-thread", text: "search 1" });
		await runtime.waitForIdle("restart-delete-thread");
		await runtime.deleteThreadCheckpoints("restart-delete-thread");

		const reloaded = new LunaRuntime({
			store,
			codex: { adapter: new FakeCodex() as unknown as any },
			worktree: {
				manager: new FakeWorktree() as unknown as any,
				checkpoints: checkpoints as unknown as any,
			},
		});

		await expect(reloaded.listThreadCheckpoints("restart-delete-thread")).resolves.toHaveLength(0);
		await expect(reloaded.getThread("restart-delete-thread")).resolves.toMatchObject({
			workspace: { checkpointSequence: 1 },
		});
	});

	it("can delete a thread record without stopping the active session", async () => {
		const codex = new FakeCodex();
		const runtime = new LunaRuntime({
			store: new MemoryThreadStore() as ThreadStore,
			codex: { adapter: codex as unknown as any },
			worktree: { manager: new FakeWorktree() as unknown as any },
		});

		await runtime.startThread({
			threadId: "thread-no-stop-delete",
			repoRoot: "/repo",
			title: "Delete without stop",
			worktree: { mode: "reuse-or-create" },
		});
		await runtime.deleteThread("thread-no-stop-delete", { stopSession: false });

		expect(codex.stoppedThreads).toHaveLength(0);
		expect(await runtime.getThread("thread-no-stop-delete")).toBeNull();
	});

	it("can resume and restart a thread using persisted state", async () => {
		const codex = new FakeCodex();
		const runtime = new LunaRuntime({
			store: new MemoryThreadStore() as ThreadStore,
			codex: { adapter: codex as unknown as any },
			worktree: { manager: new FakeWorktree() as unknown as any },
		});

		await runtime.startThread({
			threadId: "thread-restart",
			repoRoot: "/repo",
			title: "Restart me",
			worktree: { mode: "reuse-or-create" },
		});
		await runtime.resumeThread("thread-restart");
		await runtime.restartThread("thread-restart");

		expect(codex.startedSessions.length).toBeGreaterThanOrEqual(3);
		expect(codex.stoppedThreads).toContain("thread-restart");
	});

	it("waits for terminal turn events before reporting idle", async () => {
		const codex = new DeferredCodex();
		const runtime = new LunaRuntime({
			store: new MemoryThreadStore() as ThreadStore,
			codex: { adapter: codex as unknown as any },
			worktree: {
				manager: new FakeWorktree() as unknown as any,
				checkpoints: new FakeCheckpointStore() as unknown as any,
			},
		});

		await runtime.startThread({
			threadId: "thread-wait",
			repoRoot: "/repo",
			title: "Wait for completion",
			worktree: { mode: "reuse-or-create" },
		});
		await runtime.sendMessage({ threadId: "thread-wait", text: "slow task" });

		let resolved = false;
		const waiting = runtime.waitForIdle("thread-wait").then(() => {
			resolved = true;
		});
		await Promise.resolve();
		expect(resolved).toBe(false);

		codex.complete("thread-wait", "turn.completed");
		await waiting;
		expect(resolved).toBe(true);
	});
});
