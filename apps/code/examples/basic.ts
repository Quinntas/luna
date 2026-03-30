import pino from "pino";

import { LunaRuntime, MemoryThreadStore } from "../src/index";

async function main() {
	const maxRuntimeMs = Number.parseInt(process.env.LUNA_EXAMPLE_TIMEOUT_MS ?? "60000", 10);
	const prompt = process.env.LUNA_EXAMPLE_TEXT ?? "Reply with exactly DONE.";
	const logger = pino({
		name: "luna-example-basic",
		level: process.env.LOG_LEVEL ?? "info",
	});
	const runtime = new LunaRuntime({
		store: new MemoryThreadStore(),
		logger,
	});

	let finished = false;
	let timeout: ReturnType<typeof setTimeout> | undefined;
	let resolveTerminalEvent: (() => void) | undefined;
	const terminalEventSeen = new Promise<void>((resolve) => {
		resolveTerminalEvent = resolve;
	});
	const stop = () => {
		if (finished) {
			return;
		}
		finished = true;
		if (timeout) {
			clearTimeout(timeout);
		}
		unsubscribe();
		runtime.dispose();
	};

	const unsubscribe = runtime.on((event) => {
		logger.info(
			{
				eventType: event.type,
				threadId: event.threadId,
				turnId: event.turnId,
				payload: event.payload,
			},
			"luna event",
		);

		if (
			event.type === "turn.completed" ||
			event.type === "turn.aborted" ||
			event.type === "session.error" ||
			event.type === "session.exited"
		) {
			resolveTerminalEvent?.();
		}
	});

	const thread = await runtime.startThread({
		threadId: "example-thread",
		title: "Basic completion example",
		repoRoot: process.cwd(),
		worktree: {
			mode: "reuse-or-create",
			preferredBranchName: "feature/basic-completion-example",
		},
		codex: {
			model: process.env.CODEX_MODEL ?? "gpt-5.3-codex",
			runtimeMode: "full-access",
			binaryPath: process.env.CODEX_BINARY_PATH,
			homePath: process.env.CODEX_HOME,
		},
	});

	logger.info(
		{
			threadId: thread.id,
			cwd: thread.workspace.cwd,
			branch: thread.workspace.branch,
			worktreePath: thread.workspace.worktreePath,
			providerThreadId: thread.codex.providerThreadId,
		},
		"thread ready",
	);

	await runtime.sendMessage({
		threadId: thread.id,
		text: prompt,
		interactionMode: "default",
		reasoningEffort: "low",
	});

	logger.info("message sent; waiting for Codex events...");

	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);

	timeout = setTimeout(() => {
		void (async () => {
			logger.warn({ threadId: thread.id, maxRuntimeMs }, "example timed out; stopping thread");
			try {
				await runtime.stopThread(thread.id);
			} catch (error) {
				logger.warn({ error }, "failed to stop timed out thread cleanly");
			}
			resolveTerminalEvent?.();
			stop();
		})();
	}, maxRuntimeMs);

	await terminalEventSeen;
	await runtime.waitForIdle(thread.id);
	try {
		await runtime.stopThread(thread.id);
	} catch (error) {
		logger.warn({ error, threadId: thread.id }, "failed to stop thread after terminal event");
	}
	stop();
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
