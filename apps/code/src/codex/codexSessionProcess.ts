import { type ChildProcessWithoutNullStreams, spawn, spawnSync } from "node:child_process";
import readline from "node:readline";

import {
	formatCodexCliUpgradeMessage,
	isCodexCliVersionSupported,
	parseCodexCliVersion,
} from "./codexCliVersion";

const CODEX_VERSION_CHECK_TIMEOUT_MS = 4_000;

export interface SpawnCodexSessionProcessInput {
	readonly binaryPath: string;
	readonly cwd: string;
	readonly homePath?: string;
}

export interface SpawnCodexSessionProcessResult {
	readonly child: ChildProcessWithoutNullStreams;
	readonly output: readline.Interface;
}

export function killChildTree(child: ChildProcessWithoutNullStreams): void {
	if (process.platform === "win32" && child.pid !== undefined) {
		try {
			spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
			return;
		} catch {
			// fallback to direct kill
		}
	}

	child.kill();
}

export function assertSupportedCodexCliVersion(input: SpawnCodexSessionProcessInput): void {
	const result = spawnSync(input.binaryPath, ["--version"], {
		cwd: input.cwd,
		env: {
			...process.env,
			...(input.homePath ? { CODEX_HOME: input.homePath } : {}),
		},
		encoding: "utf8",
		shell: process.platform === "win32",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: CODEX_VERSION_CHECK_TIMEOUT_MS,
		maxBuffer: 1024 * 1024,
	});

	if (result.error) {
		const lower = result.error.message.toLowerCase();
		if (
			lower.includes("enoent") ||
			lower.includes("command not found") ||
			lower.includes("not found")
		) {
			throw new Error(`Codex CLI (${input.binaryPath}) is not installed or not executable.`);
		}
		throw new Error(
			`Failed to execute Codex CLI version check: ${result.error.message || String(result.error)}`,
		);
	}

	const stdout = result.stdout ?? "";
	const stderr = result.stderr ?? "";
	if (result.status !== 0) {
		const detail = stderr.trim() || stdout.trim() || `Command exited with code ${result.status}.`;
		throw new Error(`Codex CLI version check failed. ${detail}`);
	}

	const parsedVersion = parseCodexCliVersion(`${stdout}\n${stderr}`);
	if (parsedVersion && !isCodexCliVersionSupported(parsedVersion)) {
		throw new Error(formatCodexCliUpgradeMessage(parsedVersion));
	}
}

export function spawnCodexSessionProcess(
	input: SpawnCodexSessionProcessInput,
): SpawnCodexSessionProcessResult {
	const child = spawn(input.binaryPath, ["app-server"], {
		cwd: input.cwd,
		env: {
			...process.env,
			...(input.homePath ? { CODEX_HOME: input.homePath } : {}),
		},
		stdio: ["pipe", "pipe", "pipe"],
		shell: process.platform === "win32",
	});
	const output = readline.createInterface({ input: child.stdout });
	return { child, output };
}
