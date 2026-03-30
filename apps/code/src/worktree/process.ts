import { spawn } from "node:child_process";

import { GitCommandError } from "./errors";
import type { ExecuteGitInput, ExecuteGitResult, WorktreeLogger } from "./types";

function commandLabel(args: readonly string[]): string {
	return `git ${args.join(" ")}`;
}

export async function executeGitCommand(
	input: ExecuteGitInput & { gitBinary?: string; logger?: WorktreeLogger },
): Promise<ExecuteGitResult> {
	const gitBinary = input.gitBinary ?? "git";
	input.logger?.debug?.("git command start", {
		operation: input.operation,
		cwd: input.cwd,
		args: input.args,
	});

	await new Promise<void>((resolve, reject) => {
		import("node:fs")
			.then(({ access, constants }) => {
				access(input.cwd, constants.F_OK, (error) => {
					if (error) reject(error);
					else resolve();
				});
			})
			.catch(reject);
	}).catch((error) => {
		throw new GitCommandError({
			operation: input.operation,
			command: commandLabel(input.args),
			cwd: input.cwd,
			detail: "Working directory is unavailable.",
			cause: error,
		});
	});

	return await new Promise<ExecuteGitResult>((resolve, reject) => {
		const child = spawn(gitBinary, input.args, {
			cwd: input.cwd,
			env: input.env ?? process.env,
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		let finished = false;
		let timeout: ReturnType<typeof setTimeout> | undefined;

		const finish = (fn: () => void) => {
			if (finished) return;
			finished = true;
			if (timeout) clearTimeout(timeout);
			fn();
		};

		if (input.timeoutMs && input.timeoutMs > 0) {
			timeout = setTimeout(() => {
				finish(() => {
					child.kill("SIGTERM");
					reject(
						new GitCommandError({
							operation: input.operation,
							command: commandLabel(input.args),
							cwd: input.cwd,
							detail: `Command timed out after ${input.timeoutMs}ms.`,
						}),
					);
				});
			}, input.timeoutMs);
		}

		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});

		child.on("error", (error) => {
			finish(() => {
				reject(
					new GitCommandError({
						operation: input.operation,
						command: commandLabel(input.args),
						cwd: input.cwd,
						detail: "Failed to start git command.",
						cause: error,
					}),
				);
			});
		});

		child.on("close", (code) => {
			finish(() => {
				const result = {
					code: code ?? 0,
					stdout,
					stderr,
				} satisfies ExecuteGitResult;
				if (!input.allowNonZeroExit && result.code !== 0) {
					reject(
						new GitCommandError({
							operation: input.operation,
							command: commandLabel(input.args),
							cwd: input.cwd,
							detail: stderr.trim() || stdout.trim() || `Command exited with code ${result.code}.`,
						}),
					);
					return;
				}
				input.logger?.debug?.("git command finished", {
					operation: input.operation,
					cwd: input.cwd,
					args: input.args,
					code: result.code,
				});
				resolve(result);
			});
		});
	});
}
