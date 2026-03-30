export interface LunaWorktreeRequest {
	readonly mode: "repo-root" | "reuse-or-create";
	readonly branch?: string;
	readonly preferredBranchName?: string;
	readonly path?: string | null;
}

export interface LunaWorktreeBinding {
	readonly repoRoot: string;
	readonly branch: string | null;
	readonly worktreePath: string | null;
	readonly cwd: string;
	readonly reused: boolean;
}
