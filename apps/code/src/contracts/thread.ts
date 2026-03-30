import type { LunaThreadId } from "./ids";

export interface LunaThreadRecord {
	readonly id: LunaThreadId;
	readonly title: string;
	readonly repoRoot: string;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly codex: {
		readonly providerThreadId: string | null;
		readonly model: string | null;
		readonly runtimeMode: "approval-required" | "full-access";
		readonly sessionStatus: "idle" | "starting" | "ready" | "running" | "error" | "closed";
		readonly lastError: string | null;
	};
	readonly workspace: {
		readonly mode: "repo-root" | "worktree";
		readonly branch: string | null;
		readonly worktreePath: string | null;
		readonly cwd: string;
		readonly checkpointSequence: number;
		readonly checkpoints: readonly string[];
	};
	readonly history: readonly { role: "user" | "assistant"; content: string }[];
}
