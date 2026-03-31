import { spawn } from "node:child_process";
import type { LunaRuntime } from "../../index.ts";
import { env } from "../config/index.ts";
import type { TuiRefs, TuiState } from "../types.ts";
import { generateBranchName, generateCommitMessage } from "../utils/aiGenerator.ts";

interface GitChange {
	readonly file: string;
	readonly status: "M" | "A" | "D" | "R" | "??";
}

async function execCommand(
	cmd: string,
	args: string[],
	options: { cwd?: string; timeoutMs?: number } = {},
): Promise<{ stdout: string; stderr: string; code: number | null }> {
	return new Promise((resolve) => {
		const child = spawn(cmd, args, {
			cwd: options.cwd ?? env.repoRoot,
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (data) => {
			stdout += data.toString();
		});
		child.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		const timeout = options.timeoutMs
			? setTimeout(() => {
					child.kill("SIGTERM");
					stderr += "Command timed out";
				}, options.timeoutMs)
			: null;

		child.on("close", (code) => {
			if (timeout) clearTimeout(timeout);
			resolve({ stdout, stderr, code });
		});
	});
}

async function getCurrentBranch(cwd: string): Promise<string | null> {
	const result = await execCommand("git", ["branch", "--show-current"], { cwd });
	return result.stdout.trim() || null;
}

async function getBaseBranch(cwd: string): Promise<string> {
	const result = await execCommand("gh", ["repo", "view", "--json", "defaultBranchRef"], { cwd });
	try {
		const json = JSON.parse(result.stdout);
		const name = json.defaultBranchRef?.name;
		return name ?? "main";
	} catch {
		return "main";
	}
}

async function _getWorktreePath(cwd: string): Promise<string | null> {
	const result = await execCommand("git", ["rev-parse", "--show-toplevel"], { cwd });
	const path = result.stdout.trim();
	const worktreeResult = await execCommand("git", ["worktree", "list", "--porcelain"], { cwd });
	if (worktreeResult.stdout.includes(path)) {
		const lines = worktreeResult.stdout.split("\n");
		for (const line of lines) {
			if (line.startsWith("worktree ") && !line.includes("main") && !line.includes("master")) {
				const match = line.match(/worktree (.+)/);
				if (match?.[1] && !match[1].includes(path)) {
					return match[1].trim();
				}
			}
		}
	}
	return null;
}

async function getChanges(cwd: string): Promise<GitChange[]> {
	const result = await execCommand("git", ["diff", "--stat", "--porcelain"], { cwd });
	const lines = result.stdout.split("\n").filter((line) => line.trim());
	const changes: GitChange[] = [];

	for (const line of lines) {
		const status = line.substring(0, 2).trim().replace(" ", "") as GitChange["status"];
		const file = line.substring(3).trim();
		if (file) {
			changes.push({ file, status });
		}
	}

	return changes;
}

async function getUntrackedFiles(cwd: string): Promise<string[]> {
	const result = await execCommand("git", ["ls-files", "--others", "--exclude-standard"], { cwd });
	return result.stdout.split("\n").filter((f) => f.trim());
}

function sanitizeBranchName(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9/]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^\/+|\/+$/g, "")
		.slice(0, 50);
}

export async function runPrCommand(
	_state: TuiState,
	refs: TuiRefs,
	_runtime: LunaRuntime,
): Promise<void> {
	const cwd = env.repoRoot;
	refs.statusText.content = "Checking for changes...";

	const changes = await getChanges(cwd);
	const untracked = await getUntrackedFiles(cwd);

	if (changes.length === 0 && untracked.length === 0) {
		refs.statusText.content = "No changes to commit";
		return;
	}

	refs.statusText.content = "Generating branch name...";

	const branchName = await generateBranchName(changes, untracked);

	refs.statusText.content = `Creating branch: ${branchName}...`;

	const currentBranch = await getCurrentBranch(cwd);
	if (!currentBranch) {
		refs.statusText.content = "Error: Not on a branch";
		return;
	}

	const createResult = await execCommand("git", ["checkout", "-b", branchName], { cwd });
	if (createResult.code !== 0) {
		refs.statusText.content = `Error creating branch: ${createResult.stderr}`;
		return;
	}

	refs.statusText.content = "Generating commit message...";
	const commitMessage = await generateCommitMessage(changes, untracked);

	refs.statusText.content = "Staging changes...";
	const stageResult = await execCommand("git", ["add", "-A"], { cwd });
	if (stageResult.code !== 0) {
		refs.statusText.content = `Error staging: ${stageResult.stderr}`;
		return;
	}

	refs.statusText.content = "Committing...";
	const commitResult = await execCommand("git", ["commit", "-m", commitMessage], { cwd });
	if (commitResult.code !== 0) {
		refs.statusText.content = `Error committing: ${commitResult.stderr}`;
		return;
	}

	refs.statusText.content = "Pushing...";
	const pushResult = await execCommand("git", ["push", "-u", "origin", branchName], { cwd });
	if (pushResult.code !== 0) {
		refs.statusText.content = `Error pushing: ${pushResult.stderr}`;
		return;
	}

	refs.statusText.content = "Getting base branch...";
	const baseBranch = await getBaseBranch(cwd);

	refs.statusText.content = "Creating PR...";
	const prTitle = branchName.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
	const prResult = await execCommand(
		"gh",
		[
			"pr",
			"create",
			"--base",
			baseBranch,
			"--head",
			branchName,
			"--title",
			prTitle,
			"--body",
			"Automated PR via Luna",
		],
		{ cwd },
	);

	if (prResult.code !== 0) {
		refs.statusText.content = `Error creating PR: ${prResult.stderr}`;
		return;
	}

	refs.statusText.content = "PR created successfully!";
}
