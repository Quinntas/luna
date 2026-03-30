import { createInterface } from "node:readline";
import { parseArgs } from "node:util";

import { LunaRuntime, SqliteThreadStore } from "./index";

const c = {
	dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
	bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
	magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
	red: (s: string) => `\x1b[31m${s}\x1b[0m`,
	yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
	clearLine: "\r\x1b[K",
};

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

class Spinner {
	private i = 0;
	private timer: ReturnType<typeof setInterval> | undefined;
	private active = false;

	start(label = "thinking…") {
		if (this.active) return;
		this.active = true;
		this.timer = setInterval(() => {
			const frame = SPINNER_FRAMES[this.i++ % SPINNER_FRAMES.length];
			process.stdout.write(`${c.clearLine}${c.dim(`${frame} ${label}`)}`);
		}, 80);
	}

	stop() {
		if (!this.active) return;
		this.active = false;
		if (this.timer !== undefined) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
		process.stdout.write(c.clearLine);
	}
}

const env = {
	model: process.env.CODEX_MODEL ?? "gpt-5.4",
	binaryPath: process.env.CODEX_BINARY_PATH,
	homePath: process.env.CODEX_HOME,
	dbPath: process.env.LUNA_DB_PATH,
	repoRoot: process.env.LUNA_REPO_ROOT ?? process.cwd(),
};

const HOME = process.env.HOME ?? "";

function shortPath(p: string): string {
	return HOME && p.startsWith(HOME) ? `~${p.slice(HOME.length)}` : p;
}

function printHeader(threadId: string, cwd: string): void {
	const parts = [c.bold("luna"), c.dim(threadId), c.dim(shortPath(cwd))];
	process.stdout.write(`\n  ${parts.join(c.dim("  ·  "))}\n\n`);
}

const prompt = () => process.stdout.write(`${c.magenta("❯")} `);

async function runList(): Promise<void> {
	const store = new SqliteThreadStore({ dbPath: env.dbPath });
	const threads = await store.listThreads();
	store.close();

	if (threads.length === 0) {
		console.log(c.dim("No threads found."));
		return;
	}

	const COL = { id: 24, title: 28, repo: 28 };
	const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));
	const header = `  ${clip("ID", COL.id)}  ${clip("TITLE", COL.title)}  ${clip("REPO", COL.repo)}  UPDATED`;

	process.stdout.write(`${c.dim(header)}\n${c.dim("─".repeat(header.length))}\n`);
	for (const t of threads) {
		const updated = t.updatedAt.slice(0, 16).replace("T", " ");
		process.stdout.write(
			`  ${clip(t.id, COL.id)}  ${clip(t.title, COL.title)}  ${clip(shortPath(t.repoRoot), COL.repo)}  ${c.dim(updated)}\n`,
		);
	}
}

async function runSession(opts: { resume: boolean; threadId?: string }): Promise<void> {
	const spinner = new Spinner();
	const runtime = new LunaRuntime({ store: new SqliteThreadStore({ dbPath: env.dbPath }) });

	let resolveTurn: (() => void) | undefined;
	let turnDone = Promise.resolve();
	let firstDelta = true;

	const finishTurn = (output: string) => {
		spinner.stop();
		process.stdout.write(output);
		resolveTurn?.();
	};

	const unsubscribe = runtime.on((event) => {
		if (event.type === "content.delta") {
			if (firstDelta) {
				spinner.stop();
				firstDelta = false;
			}
			process.stdout.write(event.payload.delta);
			return;
		}
		if (event.type === "turn.completed") {
			finishTurn("\n");
			return;
		}
		if (event.type === "turn.aborted") {
			finishTurn(`\n${c.yellow(`⚠ ${event.payload.reason}`)}\n`);
			return;
		}
		if (event.type === "session.error") {
			finishTurn(`\n${c.red(`✖ ${event.payload.message}`)}\n`);
			return;
		}
		if (event.type === "session.exited") {
			const detail = [event.payload.exitKind, event.payload.reason].filter(Boolean).join(" — ");
			finishTurn(`\n${c.dim(`session exited${detail ? `: ${detail}` : ""}`)}\n`);
		}
	});

	let thread: Awaited<ReturnType<typeof runtime.startThread>>;

	spinner.start("connecting…");

	try {
		if (opts.resume) {
			if (opts.threadId) {
				thread = await runtime.resumeThread(opts.threadId);
			} else {
				const threads = await runtime.listThreads();
				const latest = threads.at(-1);
				if (!latest) {
					spinner.stop();
					process.stderr.write(
						`${c.red("✖ No threads to resume. Start a new session instead.")}\n`,
					);
					process.exitCode = 1;
					runtime.dispose();
					return;
				}
				thread = await runtime.resumeThread(latest.id);
			}
		} else {
			const threadId = `thread-${Date.now()}`;
			thread = await runtime.startThread({
				threadId,
				title: threadId,
				repoRoot: env.repoRoot,
				worktree: { mode: "repo-root" },
				codex: {
					model: env.model,
					runtimeMode: "full-access",
					binaryPath: env.binaryPath,
					homePath: env.homePath,
				},
			});
		}
	} catch (error) {
		spinner.stop();
		process.stderr.write(
			`${c.red(`✖ ${error instanceof Error ? error.message : String(error)}`)}\n`,
		);
		process.exitCode = 1;
		runtime.dispose();
		return;
	}

	spinner.stop();
	printHeader(thread.id, thread.workspace.cwd);

	const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
	let stopping = false;

	const stop = async () => {
		if (stopping) return;
		stopping = true;
		spinner.stop();
		rl.close();
		unsubscribe();
		try {
			await runtime.stopThread(thread.id);
		} catch {
			// best-effort
		}
		runtime.dispose();
	};

	process.on("SIGINT", () => void stop().then(() => process.exit(0)));
	process.on("SIGTERM", () => void stop().then(() => process.exit(0)));

	prompt();

	for await (const line of rl) {
		const text = line.trim();
		if (!text) {
			prompt();
			continue;
		}

		firstDelta = true;
		turnDone = new Promise<void>((resolve) => {
			resolveTurn = resolve;
		});

		spinner.start("thinking…");

		try {
			await runtime.sendMessage({
				threadId: thread.id,
				text,
				interactionMode: "default",
				reasoningEffort: "low",
			});
		} catch (error) {
			spinner.stop();
			process.stdout.write(
				`${c.red(`✖ ${error instanceof Error ? error.message : String(error)}`)}\n`,
			);
			resolveTurn?.();
		}

		await turnDone;
		if (!stopping) {
			process.stdout.write("\n");
			prompt();
		}
	}

	await stop();
}

async function main(): Promise<void> {
	const { values, positionals } = parseArgs({
		args: process.argv.slice(2),
		options: {
			resume: { type: "string", short: "r" },
			help: { type: "boolean", short: "h" },
		},
		allowPositionals: true,
		strict: false,
	});

	if (values.help) {
		process.stdout.write(`\n  ${c.bold("luna")}  —  AI coding session CLI\n\n`);
		process.stdout.write(`${c.dim("Usage:")}\n`);
		process.stdout.write(`  bun run cli                         Start a new session\n`);
		process.stdout.write(`  bun run cli -- list                 List persisted threads\n`);
		process.stdout.write(`  bun run cli -- --resume             Resume most-recent thread\n`);
		process.stdout.write(`  bun run cli -- --resume <threadId>  Resume a specific thread\n\n`);
		process.stdout.write(`${c.dim("Env vars:")}\n`);
		process.stdout.write(`  CODEX_MODEL        Model (default: gpt-5.4)\n`);
		process.stdout.write(`  CODEX_BINARY_PATH  Path to codex binary\n`);
		process.stdout.write(`  CODEX_HOME         Codex home directory\n`);
		process.stdout.write(`  LUNA_DB_PATH       SQLite path (default: ./data/luna.db)\n`);
		process.stdout.write(`  LUNA_REPO_ROOT     Repo root for new threads (default: cwd)\n\n`);
		return;
	}

	const subcommand = positionals[0];
	if (subcommand === "list") {
		await runList();
		return;
	}

	const resumeFlag = "resume" in values;
	const threadId = typeof values.resume === "string" && values.resume ? values.resume : undefined;
	await runSession({ resume: resumeFlag, threadId });
}

main().catch((error) => {
	process.stderr.write(`${c.red(`✖ ${error instanceof Error ? error.message : String(error)}`)}\n`);
	process.exitCode = 1;
});
