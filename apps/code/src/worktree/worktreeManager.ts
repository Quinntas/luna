import path from "node:path";
import { LunaWorktreeError } from "../contracts/errors";
import type { WorktreeProvisioner } from "../contracts/ports";
import type { LunaStartThreadInput } from "../contracts/session";
import type { LunaWorktreeBinding } from "../contracts/worktree";
import { resolveAutoFeatureBranchName, sanitizeFeatureBranchName } from "./branchNaming";
import { GitWorktreeClient } from "./gitClient";
import { resolveEffectiveCwd } from "./workspaceResolver";

export interface WorktreeManagerOptions {
	readonly client?: GitWorktreeClient;
	readonly worktreesDir?: string;
}

export class WorktreeManager implements WorktreeProvisioner {
	private readonly client: GitWorktreeClient;

	constructor(options?: WorktreeManagerOptions) {
		this.client = options?.client ?? new GitWorktreeClient({ worktreesDir: options?.worktreesDir });
	}

	async ensureBinding(input: LunaStartThreadInput): Promise<LunaWorktreeBinding> {
		const mode = input.worktree?.mode ?? "reuse-or-create";
		if (mode === "repo-root") {
			return {
				repoRoot: input.repoRoot,
				branch: null,
				worktreePath: null,
				cwd: resolveEffectiveCwd({ repoRoot: input.repoRoot }),
				reused: false,
			};
		}

		const status = await this.client.status({ cwd: input.repoRoot });
		const baseBranch = input.worktree?.branch ?? status.branch;
		if (!baseBranch) {
			throw new LunaWorktreeError("Cannot create a worktree from a detached HEAD.");
		}

		const preferredBranch =
			input.worktree?.preferredBranchName?.trim() ||
			sanitizeFeatureBranchName(input.title ?? input.threadId);
		const branches = await this.client.listBranches({ cwd: input.repoRoot });
		const exactExisting = branches.branches.find(
			(branch) => !branch.isRemote && branch.name === preferredBranch && branch.worktreePath,
		);
		if (exactExisting?.worktreePath) {
			return {
				repoRoot: input.repoRoot,
				branch: exactExisting.name,
				worktreePath: exactExisting.worktreePath,
				cwd: resolveEffectiveCwd({
					repoRoot: input.repoRoot,
					worktreePath: exactExisting.worktreePath,
				}),
				reused: true,
			};
		}

		const localBranchNames = branches.branches
			.filter((branch) => !branch.isRemote)
			.map((branch) => branch.name);
		const branchName = resolveAutoFeatureBranchName(localBranchNames, preferredBranch);
		const repoName = path.basename(input.repoRoot);
		const worktreePath =
			input.worktree?.path ??
			path.join(input.repoRoot, ".worktrees", repoName, branchName.replaceAll("/", "-"));
		const created = await this.client.createWorktree({
			cwd: input.repoRoot,
			branch: baseBranch,
			newBranch: branchName,
			path: worktreePath,
		});

		return {
			repoRoot: input.repoRoot,
			branch: created.worktree.branch,
			worktreePath: created.worktree.path,
			cwd: resolveEffectiveCwd({ repoRoot: input.repoRoot, worktreePath: created.worktree.path }),
			reused: false,
		};
	}

	async removeWorktree(repoRoot: string, worktreePath: string, force = true): Promise<void> {
		await this.client.removeWorktree({ cwd: repoRoot, path: worktreePath, force });
	}
}
