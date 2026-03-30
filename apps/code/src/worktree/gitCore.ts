import { stat } from "node:fs/promises";
import path from "node:path";

import { GitCommandError } from "./errors";
import { resolveAutoFeatureBranchName } from "./naming";
import { executeGitCommand } from "./process";
import type {
	ExecuteGitInput,
	ExecuteGitResult,
	GitBranch,
	GitCheckoutInput,
	GitCreateBranchInput,
	GitCreateWorktreeInput,
	GitCreateWorktreeResult,
	GitInitInput,
	GitListBranchesResult,
	GitRemoveWorktreeInput,
	GitRenameBranchInput,
	GitRenameBranchResult,
	GitStatusDetails,
	GitStatusResult,
	GitWorktreeClientOptions,
} from "./types";

function parseBranchLine(line: string): { name: string; current: boolean } | null {
	const trimmed = line.trim();
	if (trimmed.length === 0) return null;
	const name = trimmed.replace(/^[*+]\s+/, "");
	if (name.includes(" -> ") || name.startsWith("(")) return null;
	return { name, current: trimmed.startsWith("* ") };
}

function parseRemoteNames(stdout: string): string[] {
	return stdout
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.toSorted((a, b) => b.length - a.length);
}

function parseRemoteRefWithRemoteNames(
	branchName: string,
	remoteNames: readonly string[],
): { remoteRef: string; remoteName: string; localBranch: string } | null {
	const trimmedBranchName = branchName.trim();
	if (trimmedBranchName.length === 0) return null;

	for (const remoteName of remoteNames) {
		const remotePrefix = `${remoteName}/`;
		if (!trimmedBranchName.startsWith(remotePrefix)) continue;
		const localBranch = trimmedBranchName.slice(remotePrefix.length).trim();
		if (localBranch.length === 0) return null;
		return { remoteRef: trimmedBranchName, remoteName, localBranch };
	}

	return null;
}

function parseTrackingBranchByUpstreamRef(stdout: string, upstreamRef: string): string | null {
	for (const line of stdout.split("\n")) {
		const trimmedLine = line.trim();
		if (trimmedLine.length === 0) continue;
		const [branchNameRaw, upstreamBranchRaw = ""] = trimmedLine.split("\t");
		const branchName = branchNameRaw?.trim() ?? "";
		const upstreamBranch = upstreamBranchRaw.trim();
		if (branchName.length > 0 && upstreamBranch === upstreamRef) {
			return branchName;
		}
	}

	return null;
}

function deriveLocalBranchNameFromRemoteRef(branchName: string): string | null {
	const separatorIndex = branchName.indexOf("/");
	if (separatorIndex <= 0 || separatorIndex === branchName.length - 1) {
		return null;
	}

	const localBranch = branchName.slice(separatorIndex + 1).trim();
	return localBranch.length > 0 ? localBranch : null;
}

function parseBranchAb(value: string): { ahead: number; behind: number } {
	let ahead = 0;
	let behind = 0;

	for (const part of value.split(/\s+/)) {
		if (part.startsWith("+")) ahead = Number.parseInt(part.slice(1), 10) || 0;
		if (part.startsWith("-")) behind = Number.parseInt(part.slice(1), 10) || 0;
	}

	return { ahead, behind };
}

function parsePorcelainPath(line: string): string | null {
	if (line.startsWith("1 ") || line.startsWith("2 ") || line.startsWith("u ")) {
		const tabIndex = line.indexOf("\t");
		if (tabIndex >= 0) {
			const fromTab = line.slice(tabIndex + 1);
			const [filePath] = fromTab.split("\t");
			return filePath?.trim().length ? filePath.trim() : null;
		}
	}

	const parts = line.trim().split(/\s+/g);
	const filePath = parts.at(-1) ?? "";
	return filePath.length > 0 ? filePath : null;
}

function parseNumstatEntries(
	stdout: string,
): Array<{ path: string; insertions: number; deletions: number }> {
	return stdout
		.split(/\r?\n/g)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.flatMap((line) => {
			const [insertionsRaw = "0", deletionsRaw = "0", ...pathParts] = line.split("\t");
			const filePath = pathParts.join("\t").trim();
			if (!filePath) return [];
			const insertions = insertionsRaw === "-" ? 0 : Number.parseInt(insertionsRaw, 10) || 0;
			const deletions = deletionsRaw === "-" ? 0 : Number.parseInt(deletionsRaw, 10) || 0;
			return [{ path: filePath, insertions, deletions }];
		});
}

async function pathExists(targetPath: string): Promise<boolean> {
	try {
		await stat(targetPath);
		return true;
	} catch {
		return false;
	}
}

export class GitWorktreeClient {
	private readonly gitBinary?: string;
	private readonly worktreesDir?: string;
	private readonly logger?: GitWorktreeClientOptions["logger"];

	constructor(options?: GitWorktreeClientOptions) {
		this.gitBinary = options?.gitBinary;
		this.worktreesDir = options?.worktreesDir;
		this.logger = options?.logger;
	}

	private log(
		level: "info" | "warn" | "debug",
		message: string,
		context?: Record<string, unknown>,
	) {
		this.logger?.[level]?.(message, context);
	}

	execute(input: ExecuteGitInput): Promise<ExecuteGitResult> {
		return executeGitCommand({ ...input, gitBinary: this.gitBinary, logger: this.logger });
	}

	async statusDetails(cwd: string): Promise<GitStatusDetails> {
		const [statusStdout, unstagedNumstatStdout, stagedNumstatStdout] = await Promise.all([
			this.execute({
				operation: "GitWorktreeClient.statusDetails.status",
				cwd,
				args: ["status", "--porcelain=2", "--branch"],
			}).then((result) => result.stdout),
			this.execute({
				operation: "GitWorktreeClient.statusDetails.unstagedNumstat",
				cwd,
				args: ["diff", "--numstat"],
			}).then((result) => result.stdout),
			this.execute({
				operation: "GitWorktreeClient.statusDetails.stagedNumstat",
				cwd,
				args: ["diff", "--cached", "--numstat"],
			}).then((result) => result.stdout),
		]);

		let branch: string | null = null;
		let upstreamRef: string | null = null;
		let aheadCount = 0;
		let behindCount = 0;
		let hasWorkingTreeChanges = false;
		const changedFilesWithoutNumstat = new Set<string>();

		for (const line of statusStdout.split(/\r?\n/g)) {
			if (line.startsWith("# branch.head ")) {
				const value = line.slice("# branch.head ".length).trim();
				branch = value.startsWith("(") ? null : value;
				continue;
			}
			if (line.startsWith("# branch.upstream ")) {
				const value = line.slice("# branch.upstream ".length).trim();
				upstreamRef = value.length > 0 ? value : null;
				continue;
			}
			if (line.startsWith("# branch.ab ")) {
				const parsed = parseBranchAb(line.slice("# branch.ab ".length).trim());
				aheadCount = parsed.ahead;
				behindCount = parsed.behind;
				continue;
			}
			if (line.trim().length > 0 && !line.startsWith("#")) {
				hasWorkingTreeChanges = true;
				const pathValue = parsePorcelainPath(line);
				if (pathValue) changedFilesWithoutNumstat.add(pathValue);
			}
		}

		const stagedEntries = parseNumstatEntries(stagedNumstatStdout);
		const unstagedEntries = parseNumstatEntries(unstagedNumstatStdout);
		const fileStatMap = new Map<string, { insertions: number; deletions: number }>();

		for (const entry of [...stagedEntries, ...unstagedEntries]) {
			const existing = fileStatMap.get(entry.path) ?? { insertions: 0, deletions: 0 };
			existing.insertions += entry.insertions;
			existing.deletions += entry.deletions;
			fileStatMap.set(entry.path, existing);
		}

		let insertions = 0;
		let deletions = 0;
		const files = Array.from(fileStatMap.entries())
			.map(([filePath, stat]) => {
				insertions += stat.insertions;
				deletions += stat.deletions;
				return { path: filePath, insertions: stat.insertions, deletions: stat.deletions };
			})
			.toSorted((a, b) => a.path.localeCompare(b.path));

		const allFiles = [...files];
		for (const filePath of changedFilesWithoutNumstat) {
			if (!fileStatMap.has(filePath)) {
				allFiles.push({ path: filePath, insertions: 0, deletions: 0 });
			}
		}

		return {
			branch,
			upstreamRef,
			hasWorkingTreeChanges,
			workingTree: {
				files: allFiles.toSorted((a, b) => a.path.localeCompare(b.path)),
				insertions,
				deletions,
			},
			hasUpstream: upstreamRef !== null,
			aheadCount,
			behindCount,
		};
	}

	async status(input: { cwd: string }): Promise<GitStatusResult> {
		const details = await this.statusDetails(input.cwd);
		return {
			branch: details.branch,
			hasWorkingTreeChanges: details.hasWorkingTreeChanges,
			workingTree: details.workingTree,
			hasUpstream: details.hasUpstream,
			aheadCount: details.aheadCount,
			behindCount: details.behindCount,
			pr: null,
		};
	}

	async listLocalBranchNames(cwd: string): Promise<string[]> {
		const stdout = (
			await this.execute({
				operation: "GitWorktreeClient.listLocalBranchNames",
				cwd,
				args: ["branch", "--list", "--format=%(refname:short)"],
			})
		).stdout;
		return stdout
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
	}

	private async resolveAvailableBranchName(cwd: string, preferredBranch: string): Promise<string> {
		const existingBranchNames = await this.listLocalBranchNames(cwd);
		return resolveAutoFeatureBranchName(existingBranchNames, preferredBranch);
	}

	async listBranches(input: { cwd: string }): Promise<GitListBranchesResult> {
		const localBranchResult = await this.execute({
			operation: "GitWorktreeClient.listBranches.branchNoColor",
			cwd: input.cwd,
			args: ["branch", "--no-color"],
			timeoutMs: 10_000,
			allowNonZeroExit: true,
		});

		if (localBranchResult.code !== 0) {
			const stderr = localBranchResult.stderr.trim();
			if (stderr.toLowerCase().includes("not a git repository")) {
				return { branches: [], isRepo: false, hasOriginRemote: false };
			}
			throw new GitCommandError({
				operation: "GitWorktreeClient.listBranches",
				command: "git branch --no-color",
				cwd: input.cwd,
				detail: stderr || "git branch failed",
			});
		}

		const [defaultRef, worktreeList, remoteBranchResult, remoteNamesResult] = await Promise.all([
			this.execute({
				operation: "GitWorktreeClient.listBranches.defaultRef",
				cwd: input.cwd,
				args: ["symbolic-ref", "refs/remotes/origin/HEAD"],
				timeoutMs: 5_000,
				allowNonZeroExit: true,
			}),
			this.execute({
				operation: "GitWorktreeClient.listBranches.worktreeList",
				cwd: input.cwd,
				args: ["worktree", "list", "--porcelain"],
				timeoutMs: 5_000,
				allowNonZeroExit: true,
			}),
			this.execute({
				operation: "GitWorktreeClient.listBranches.remoteBranches",
				cwd: input.cwd,
				args: ["branch", "--no-color", "--remotes"],
				timeoutMs: 10_000,
				allowNonZeroExit: true,
			}).catch(() => ({ code: 1, stdout: "", stderr: "" })),
			this.execute({
				operation: "GitWorktreeClient.listBranches.remoteNames",
				cwd: input.cwd,
				args: ["remote"],
				timeoutMs: 5_000,
				allowNonZeroExit: true,
			}).catch(() => ({ code: 1, stdout: "", stderr: "" })),
		]);

		const remoteNames =
			remoteNamesResult.code === 0 ? parseRemoteNames(remoteNamesResult.stdout) : [];
		const defaultBranch =
			defaultRef.code === 0
				? defaultRef.stdout.trim().replace(/^refs\/remotes\/origin\//, "")
				: null;

		const worktreeMap = new Map<string, string>();
		if (worktreeList.code === 0) {
			let currentPath: string | null = null;
			for (const line of worktreeList.stdout.split("\n")) {
				if (line.startsWith("worktree ")) {
					const candidatePath = line.slice("worktree ".length);
					currentPath = (await pathExists(candidatePath)) ? candidatePath : null;
				} else if (line.startsWith("branch refs/heads/") && currentPath) {
					worktreeMap.set(line.slice("branch refs/heads/".length), currentPath);
				} else if (line === "") {
					currentPath = null;
				}
			}
		}

		const localBranches = localBranchResult.stdout
			.split("\n")
			.map(parseBranchLine)
			.filter((branch): branch is { name: string; current: boolean } => branch !== null)
			.map((branch) => ({
				name: branch.name,
				current: branch.current,
				isRemote: false,
				isDefault: branch.name === defaultBranch,
				worktreePath: worktreeMap.get(branch.name) ?? null,
			}))
			.toSorted((a, b) => {
				const aPriority = a.current ? 0 : a.isDefault ? 1 : 2;
				const bPriority = b.current ? 0 : b.isDefault ? 1 : 2;
				return aPriority !== bPriority ? aPriority - bPriority : a.name.localeCompare(b.name);
			});

		const remoteBranches: GitBranch[] =
			remoteBranchResult.code === 0
				? remoteBranchResult.stdout
						.split("\n")
						.map(parseBranchLine)
						.filter((branch): branch is { name: string; current: boolean } => branch !== null)
						.map((branch) => {
							const parsedRemoteRef = parseRemoteRefWithRemoteNames(branch.name, remoteNames);
							return {
								name: branch.name,
								current: false,
								isRemote: true,
								remoteName: parsedRemoteRef?.remoteName,
								isDefault: false,
								worktreePath: null,
							} satisfies GitBranch;
						})
						.toSorted((a, b) => a.name.localeCompare(b.name))
				: [];

		return {
			branches: [...localBranches, ...remoteBranches],
			isRepo: true,
			hasOriginRemote: remoteNames.includes("origin"),
		};
	}

	async createWorktree(input: GitCreateWorktreeInput): Promise<GitCreateWorktreeResult> {
		const targetBranch = input.newBranch ?? input.branch;
		const sanitizedBranch = targetBranch.replace(/\//g, "-");
		const repoName = path.basename(input.cwd);
		const baseDir = this.worktreesDir ?? path.join(input.cwd, ".worktrees");
		const worktreePath = input.path ?? path.join(baseDir, repoName, sanitizedBranch);
		const args = input.newBranch
			? ["worktree", "add", "-b", input.newBranch, worktreePath, input.branch]
			: ["worktree", "add", worktreePath, input.branch];

		this.log("info", "create worktree", { cwd: input.cwd, worktreePath, branch: targetBranch });
		await this.execute({
			operation: "GitWorktreeClient.createWorktree",
			cwd: input.cwd,
			args,
			timeoutMs: 30_000,
		});

		return { worktree: { path: worktreePath, branch: targetBranch } };
	}

	async removeWorktree(input: GitRemoveWorktreeInput): Promise<void> {
		const args = ["worktree", "remove"];
		if (input.force) args.push("--force");
		args.push(input.path);

		await this.execute({
			operation: "GitWorktreeClient.removeWorktree",
			cwd: input.cwd,
			args,
			timeoutMs: 15_000,
		});
	}

	async renameBranch(input: GitRenameBranchInput): Promise<GitRenameBranchResult> {
		if (input.oldBranch === input.newBranch) {
			return { branch: input.newBranch };
		}

		const targetBranch = await this.resolveAvailableBranchName(input.cwd, input.newBranch);
		await this.execute({
			operation: "GitWorktreeClient.renameBranch",
			cwd: input.cwd,
			args: ["branch", "-m", "--", input.oldBranch, targetBranch],
			timeoutMs: 10_000,
		});

		return { branch: targetBranch };
	}

	async createBranch(input: GitCreateBranchInput): Promise<void> {
		await this.execute({
			operation: "GitWorktreeClient.createBranch",
			cwd: input.cwd,
			args: ["branch", input.branch],
			timeoutMs: 10_000,
		});
	}

	async checkoutBranch(input: GitCheckoutInput): Promise<void> {
		const [localInputExists, remoteNamesResult] = await Promise.all([
			this.execute({
				operation: "GitWorktreeClient.checkoutBranch.localInputExists",
				cwd: input.cwd,
				args: ["show-ref", "--verify", "--quiet", `refs/heads/${input.branch}`],
				timeoutMs: 5_000,
				allowNonZeroExit: true,
			}).then((result) => result.code === 0),
			this.execute({
				operation: "GitWorktreeClient.checkoutBranch.remoteNames",
				cwd: input.cwd,
				args: ["remote"],
				timeoutMs: 5_000,
				allowNonZeroExit: true,
			}),
		]);

		const remoteNames =
			remoteNamesResult.code === 0 ? parseRemoteNames(remoteNamesResult.stdout) : [];
		const remoteInfo = parseRemoteRefWithRemoteNames(input.branch, remoteNames);
		const remoteExists = remoteInfo
			? await this.execute({
					operation: "GitWorktreeClient.checkoutBranch.remoteExists",
					cwd: input.cwd,
					args: ["show-ref", "--verify", "--quiet", `refs/remotes/${input.branch}`],
					timeoutMs: 5_000,
					allowNonZeroExit: true,
				}).then((result) => result.code === 0)
			: false;

		const localTrackingBranch = remoteExists
			? await this.execute({
					operation: "GitWorktreeClient.checkoutBranch.localTrackingBranch",
					cwd: input.cwd,
					args: ["for-each-ref", "--format=%(refname:short)\t%(upstream:short)", "refs/heads"],
					timeoutMs: 5_000,
					allowNonZeroExit: true,
				}).then((result) =>
					result.code === 0 ? parseTrackingBranchByUpstreamRef(result.stdout, input.branch) : null,
				)
			: null;

		const localTrackedBranchCandidate = deriveLocalBranchNameFromRemoteRef(input.branch);
		const localTrackedBranchTargetExists =
			remoteExists && localTrackedBranchCandidate
				? await this.execute({
						operation: "GitWorktreeClient.checkoutBranch.localTrackedBranchTargetExists",
						cwd: input.cwd,
						args: ["show-ref", "--verify", "--quiet", `refs/heads/${localTrackedBranchCandidate}`],
						timeoutMs: 5_000,
						allowNonZeroExit: true,
					}).then((result) => result.code === 0)
				: false;

		const checkoutArgs = localInputExists
			? ["checkout", input.branch]
			: remoteExists && !localTrackingBranch && localTrackedBranchTargetExists
				? ["checkout", input.branch]
				: remoteExists && !localTrackingBranch
					? ["checkout", "--track", input.branch]
					: remoteExists && localTrackingBranch
						? ["checkout", localTrackingBranch]
						: ["checkout", input.branch];

		await this.execute({
			operation: "GitWorktreeClient.checkoutBranch.checkout",
			cwd: input.cwd,
			args: checkoutArgs,
			timeoutMs: 10_000,
		});
	}

	async initRepo(input: GitInitInput): Promise<void> {
		await this.execute({
			operation: "GitWorktreeClient.initRepo",
			cwd: input.cwd,
			args: ["init"],
			timeoutMs: 10_000,
		});
	}
}
