import type { LunaStartThreadInput } from "../contracts/session";
import type { LunaThreadRecord } from "../contracts/thread";
import type { LunaWorktreeBinding } from "../contracts/worktree";

export function createInitialThreadRecord(input: LunaStartThreadInput): LunaThreadRecord {
	const now = new Date().toISOString();
	return {
		id: input.threadId,
		title: input.title?.trim() || input.threadId,
		repoRoot: input.repoRoot,
		createdAt: now,
		updatedAt: now,
		codex: {
			providerThreadId: null,
			model: input.codex?.model ?? null,
			runtimeMode: input.codex?.runtimeMode ?? "approval-required",
			sessionStatus: "idle",
			lastError: null,
		},
		workspace: {
			mode: input.worktree?.mode === "reuse-or-create" ? "worktree" : "repo-root",
			branch: null,
			worktreePath: null,
			cwd: input.repoRoot,
			checkpointSequence: 0,
			checkpoints: [],
		},
		history: [],
	};
}

export function applyWorkspaceBinding(
	thread: LunaThreadRecord,
	binding: LunaWorktreeBinding,
): LunaThreadRecord {
	return {
		...thread,
		updatedAt: new Date().toISOString(),
		workspace: {
			mode: binding.worktreePath ? "worktree" : "repo-root",
			branch: binding.branch,
			worktreePath: binding.worktreePath,
			cwd: binding.cwd,
			checkpointSequence: thread.workspace.checkpointSequence,
			checkpoints: thread.workspace.checkpoints,
		},
	};
}

export function appendCheckpointRef(
	thread: LunaThreadRecord,
	checkpointRef: string,
): LunaThreadRecord {
	return {
		...thread,
		updatedAt: new Date().toISOString(),
		workspace: {
			...thread.workspace,
			checkpointSequence: thread.workspace.checkpointSequence + 1,
			checkpoints: [...thread.workspace.checkpoints, checkpointRef],
		},
	};
}

export function removeCheckpointRefs(
	thread: LunaThreadRecord,
	checkpointRefs: ReadonlyArray<string>,
): LunaThreadRecord {
	const refsToRemove = new Set(checkpointRefs);
	return {
		...thread,
		updatedAt: new Date().toISOString(),
		workspace: {
			...thread.workspace,
			checkpoints: thread.workspace.checkpoints.filter(
				(checkpointRef) => !refsToRemove.has(checkpointRef),
			),
		},
	};
}

export function markSessionStarting(thread: LunaThreadRecord): LunaThreadRecord {
	return {
		...thread,
		updatedAt: new Date().toISOString(),
		codex: { ...thread.codex, sessionStatus: "starting", lastError: null },
	};
}

export function markSessionReady(
	thread: LunaThreadRecord,
	providerThreadId: string | null,
): LunaThreadRecord {
	return {
		...thread,
		updatedAt: new Date().toISOString(),
		codex: { ...thread.codex, providerThreadId, sessionStatus: "ready", lastError: null },
	};
}

export function markSessionError(thread: LunaThreadRecord, message: string): LunaThreadRecord {
	return {
		...thread,
		updatedAt: new Date().toISOString(),
		codex: { ...thread.codex, sessionStatus: "error", lastError: message },
	};
}

export function markSessionClosed(thread: LunaThreadRecord): LunaThreadRecord {
	return {
		...thread,
		updatedAt: new Date().toISOString(),
		codex: { ...thread.codex, sessionStatus: "closed" },
	};
}
