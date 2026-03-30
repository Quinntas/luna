import { parseArgs } from "node:util";

import {
	BoxRenderable,
	createCliRenderer,
	InputRenderable,
	MarkdownRenderable,
	ScrollBoxRenderable,
	SyntaxStyle,
	TextRenderable,
} from "@opentui/core";

import { LunaRuntime, SqliteThreadStore } from "./index";

// ── Config ───────────────────────────────────────────────────────────────────

const env = {
	model: process.env.CODEX_MODEL ?? "gpt-5.4",
	binaryPath: process.env.CODEX_BINARY_PATH,
	homePath: process.env.CODEX_HOME,
	dbPath: process.env.LUNA_DB_PATH,
	repoRoot: process.env.LUNA_REPO_ROOT ?? process.cwd(),
};

const HOME = process.env.HOME ?? "";
const shortPath = (p: string) => (HOME && p.startsWith(HOME) ? `~${p.slice(HOME.length)}` : p);

// ── Theme ────────────────────────────────────────────────────────────────────

const theme = {
	text: "#cdd6f4",
	subtext: "#a6adc8",
	muted: "#585b70",
	surface: "#1e1e2e",
	border: "#45475a",
	mauve: "#cba6f7",
	sky: "#89dceb",
	red: "#f38ba8",
	yellow: "#f9e2af",
	green: "#a6e3a1",
};

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SCROLL_STEP = 3;

// ── TUI ──────────────────────────────────────────────────────────────────────

async function runTui(opts: { resume: boolean; threadId?: string }): Promise<void> {
	const renderer = await createCliRenderer({
		useAlternateScreen: true,
		exitOnCtrlC: false,
		useMouse: true,
	});

	const syntaxStyle = SyntaxStyle.create();

	// ── Root layout ───────────────────────────────────────────────────────────

	renderer.root.flexDirection = "column";

	// Header
	const header = new TextRenderable(renderer, {
		content: "  luna",
		height: 1,
		paddingX: 2,
		fg: theme.muted,
	});
	renderer.root.add(header);

	// Message area
	const scrollBox = new ScrollBoxRenderable(renderer, {
		flexGrow: 1,
		scrollY: true,
		stickyScroll: true,
		paddingX: 2,
		paddingY: 1,
	});
	renderer.root.add(scrollBox);

	// Hint bar
	const hintBar = new TextRenderable(renderer, {
		content: "  PgUp/PgDn scroll  ·  Ctrl+C quit",
		height: 1,
		paddingX: 2,
		fg: theme.muted,
	});
	renderer.root.add(hintBar);

	// Input box
	const inputBox = new BoxRenderable(renderer, {
		height: 3,
		border: true,
		borderStyle: "rounded",
		borderColor: theme.border,
		flexDirection: "row",
		alignItems: "center",
		paddingX: 1,
	});
	renderer.root.add(inputBox);

	const promptGlyph = new TextRenderable(renderer, {
		content: "❯ ",
		width: 2,
		fg: theme.mauve,
	});
	inputBox.add(promptGlyph);

	const input = new InputRenderable(renderer, {
		flexGrow: 1,
		placeholder: "Type a message and press Enter…",
	});
	inputBox.add(input);

	const statusText = new TextRenderable(renderer, {
		content: "connecting",
		width: 14,
		fg: theme.muted,
	});
	inputBox.add(statusText);

	// ── State ─────────────────────────────────────────────────────────────────

	let inputEnabled = false;
	let currentResponse: MarkdownRenderable | null = null;
	let spinnerTimer: ReturnType<typeof setInterval> | undefined;
	let spinnerIdx = 0;

	const startSpinner = (label: string) => {
		statusText.content = `${SPINNER_FRAMES[0]} ${label}`;
		spinnerTimer = setInterval(() => {
			statusText.content = `${SPINNER_FRAMES[spinnerIdx++ % SPINNER_FRAMES.length]} ${label}`;
		}, 80);
	};

	const stopSpinner = (label: string) => {
		if (spinnerTimer !== undefined) {
			clearInterval(spinnerTimer);
			spinnerTimer = undefined;
		}
		statusText.content = label;
	};

	// ── Message helpers ───────────────────────────────────────────────────────

	function addUserMessage(text: string): void {
		const box = new BoxRenderable(renderer, {
			border: true,
			borderStyle: "rounded",
			borderColor: theme.border,
			title: " You ",
			titleAlignment: "left",
			paddingX: 1,
			marginBottom: 1,
		});
		const msg = new TextRenderable(renderer, {
			content: text,
			fg: theme.text,
		});
		box.add(msg);
		scrollBox.add(box);
	}

	function addAgentMessage(): MarkdownRenderable {
		const wrapper = new BoxRenderable(renderer, {
			flexDirection: "column",
			paddingLeft: 1,
			marginBottom: 1,
		});
		const label = new TextRenderable(renderer, {
			content: "luna",
			height: 1,
			fg: theme.mauve,
			marginBottom: 1,
		});
		const md = new MarkdownRenderable(renderer, {
			content: "",
			syntaxStyle,
			streaming: true,
		});
		wrapper.add(label);
		wrapper.add(md);
		scrollBox.add(wrapper);
		return md;
	}

	// ── Runtime ───────────────────────────────────────────────────────────────

	const runtime = new LunaRuntime({ store: new SqliteThreadStore({ dbPath: env.dbPath }) });

	const finishTurn = (status: string, statusColor?: string) => {
		if (currentResponse) {
			currentResponse.streaming = false;
			currentResponse = null;
		}
		stopSpinner(status);
		if (statusColor) statusText.fg = statusColor;
		inputEnabled = true;
		input.focus();
	};

	runtime.on((event) => {
		if (event.type === "content.delta") {
			currentResponse ??= addAgentMessage();
			currentResponse.content += event.payload.delta;
			return;
		}
		if (event.type === "turn.completed") {
			finishTurn("idle");
			statusText.fg = theme.muted;
			return;
		}
		if (event.type === "turn.aborted") {
			finishTurn("aborted", theme.yellow);
			return;
		}
		if (event.type === "session.error") {
			finishTurn("error", theme.red);
			return;
		}
		if (event.type === "session.exited") {
			if (currentResponse) {
				currentResponse.streaming = false;
				currentResponse = null;
			}
			stopSpinner("exited");
			statusText.fg = theme.muted;
			inputEnabled = false;
		}
	});

	// ── Message sending ───────────────────────────────────────────────────────

	let thread: Awaited<ReturnType<typeof runtime.startThread>> | undefined;

	async function sendMessage(text: string): Promise<void> {
		if (!thread || !inputEnabled) return;
		inputEnabled = false;
		scrollBox.stickyScroll = true;
		addUserMessage(text);
		currentResponse = addAgentMessage();
		startSpinner("thinking");
		statusText.fg = theme.muted;
		try {
			await runtime.sendMessage({
				threadId: thread.id,
				text,
				interactionMode: "default",
				reasoningEffort: "low",
			});
		} catch {
			finishTurn("error", theme.red);
		}
	}

	// ── Key handling ─────────────────────────────────────────────────────────

	renderer.keyInput.on("keypress", (event) => {
		// Quit
		if (event.ctrl && event.name === "c") {
			void (async () => {
				try {
					if (thread) await runtime.stopThread(thread.id);
				} catch {}
				runtime.dispose();
				renderer.destroy();
				process.exit(0);
			})();
			return;
		}

		// Send on Enter
		if (event.name === "return" && !event.ctrl && !event.shift && !event.meta) {
			const text = input.value.trim();
			if (text && inputEnabled) {
				input.value = "";
				void sendMessage(text);
			}
			event.stopPropagation();
			return;
		}

		// Keyboard scroll
		if (event.name === "pageup" || (event.shift && event.name === "up")) {
			scrollBox.stickyScroll = false;
			scrollBox.scrollBy(-SCROLL_STEP);
			event.stopPropagation();
			return;
		}
		if (event.name === "pagedown" || (event.shift && event.name === "down")) {
			scrollBox.scrollBy(SCROLL_STEP);
			event.stopPropagation();
			return;
		}
	});

	// ── Start or resume thread ────────────────────────────────────────────────

	startSpinner("connecting");

	try {
		if (opts.resume) {
			const threads = await runtime.listThreads();
			const target = opts.threadId ? threads.find((t) => t.id === opts.threadId) : threads.at(-1);
			if (!target) throw new Error("No thread to resume");
			thread = await runtime.resumeThread(target.id);
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
		header.content = `  luna  ·  ${env.model}  ·  ${shortPath(thread.workspace.cwd)}`;
		stopSpinner("idle");
		statusText.fg = theme.muted;
		inputEnabled = true;
		input.focus();
	} catch (error) {
		stopSpinner("failed");
		statusText.fg = theme.red;
		header.content = `  luna  ·  ${error instanceof Error ? error.message : String(error)}`;
	}
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
	const { values } = parseArgs({
		args: process.argv.slice(2),
		options: { resume: { type: "string", short: "r" } },
		strict: false,
	});

	const resumeFlag = "resume" in values;
	const threadId = typeof values.resume === "string" && values.resume ? values.resume : undefined;
	await runTui({ resume: resumeFlag, threadId });
}

if (import.meta.main) {
	main().catch((error) => {
		process.stderr.write(`✖ ${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
