import pino from "pino";

import { LunaRuntime, SqliteThreadStore } from "../src/index";

async function main() {
	const logger = pino({
		name: "luna-example-restore",
		level: process.env.LOG_LEVEL ?? "info",
	});
	const runtime = new LunaRuntime({
		store: new SqliteThreadStore(),
		logger,
	});

	const thread = await runtime.startThread({
		threadId: "restore-example-thread",
		title: "Restore latest checkpoint example",
		repoRoot: process.cwd(),
		worktree: {
			mode: "reuse-or-create",
			preferredBranchName: "feature/restore-example-thread",
		},
		codex: {
			model: process.env.CODEX_MODEL ?? "gpt-5.3-codex",
			runtimeMode: "approval-required",
			binaryPath: process.env.CODEX_BINARY_PATH,
			homePath: process.env.CODEX_HOME,
		},
	});

	await runtime.sendMessage({
		threadId: thread.id,
		text: "Search this repository for authentication flow and summarize the important files.",
	});
	await runtime.waitForIdle(thread.id);

	const checkpoints = await runtime.listThreadCheckpoints(thread.id);
	logger.info({ checkpoints }, "captured checkpoints");

	if (checkpoints.length > 0) {
		const restored = await runtime.restoreThreadCheckpoint(thread.id);
		logger.info({ restored }, "restored latest checkpoint");
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
