export interface GitBranch {
	readonly name: string;
	readonly isRemote?: boolean;
	readonly remoteName?: string;
	readonly current: boolean;
	readonly isDefault: boolean;
	readonly worktreePath: string | null;
}

export interface GitListBranchesResult {
	readonly branches: readonly GitBranch[];
	readonly isRepo: boolean;
	readonly hasOriginRemote: boolean;
}

export interface GitStatusFile {
	readonly path: string;
	readonly insertions: number;
	readonly deletions: number;
}

export interface GitStatusResult {
	readonly branch: string | null;
	readonly hasWorkingTreeChanges: boolean;
	readonly workingTree: {
		readonly files: readonly GitStatusFile[];
		readonly insertions: number;
		readonly deletions: number;
	};
	readonly hasUpstream: boolean;
	readonly aheadCount: number;
	readonly behindCount: number;
	readonly pr: null;
}

export interface GitStatusDetails extends Omit<GitStatusResult, "pr"> {
	readonly upstreamRef: string | null;
}

export interface GitWorktree {
	readonly path: string;
	readonly branch: string;
}

export interface GitCreateWorktreeInput {
	readonly cwd: string;
	readonly branch: string;
	readonly newBranch?: string;
	readonly path?: string | null;
}

export interface GitCreateWorktreeResult {
	readonly worktree: GitWorktree;
}

export interface GitRemoveWorktreeInput {
	readonly cwd: string;
	readonly path: string;
	readonly force?: boolean;
}

export interface GitRenameBranchInput {
	readonly cwd: string;
	readonly oldBranch: string;
	readonly newBranch: string;
}

export interface GitRenameBranchResult {
	readonly branch: string;
}

export interface GitCreateBranchInput {
	readonly cwd: string;
	readonly branch: string;
}

export interface GitCheckoutInput {
	readonly cwd: string;
	readonly branch: string;
}

export interface GitInitInput {
	readonly cwd: string;
}

export interface ExecuteGitInput {
	readonly operation: string;
	readonly cwd: string;
	readonly args: readonly string[];
	readonly env?: NodeJS.ProcessEnv;
	readonly allowNonZeroExit?: boolean;
	readonly timeoutMs?: number;
}

export interface ExecuteGitResult {
	readonly code: number;
	readonly stdout: string;
	readonly stderr: string;
}

export interface WorkspaceBinding {
	readonly threadId: string;
	readonly repoRoot: string;
	readonly branch: string | null;
	readonly worktreePath: string | null;
}

export interface ResolveEffectiveCwdInput {
	readonly repoRoot: string;
	readonly worktreePath?: string | null;
	readonly sessionCwd?: string | null;
}

export interface CaptureCheckpointInput {
	readonly cwd: string;
	readonly checkpointRef: string;
}

export interface HasCheckpointRefInput {
	readonly cwd: string;
	readonly checkpointRef: string;
}

export interface RestoreCheckpointInput {
	readonly cwd: string;
	readonly checkpointRef: string;
	readonly fallbackToHead?: boolean;
}

export interface DiffCheckpointsInput {
	readonly cwd: string;
	readonly fromCheckpointRef: string;
	readonly toCheckpointRef: string;
	readonly fallbackFromToHead?: boolean;
}

export interface DeleteCheckpointRefsInput {
	readonly cwd: string;
	readonly checkpointRefs: readonly string[];
}

export interface WorktreeLogger {
	info?: (message: string, context?: Record<string, unknown>) => void;
	warn?: (message: string, context?: Record<string, unknown>) => void;
	debug?: (message: string, context?: Record<string, unknown>) => void;
}

export interface GitWorktreeClientOptions {
	readonly gitBinary?: string;
	readonly worktreesDir?: string;
	readonly logger?: WorktreeLogger;
}
