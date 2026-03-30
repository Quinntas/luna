import { parseArgs } from "node:util";

import {
	BoxRenderable,
	createCliRenderer,
	MarkdownRenderable,
	ScrollBoxRenderable,
	SyntaxStyle,
	TextareaRenderable,
	TextRenderable,
} from "@opentui/core";
import type { ThreadTokenUsageSnapshot } from "./codex/typesCore";
import { LunaRuntime, SqliteThreadStore } from "./index";

// ── Config ───────────────────────────────────────────────────────────────────

const env = {
	model: process.env.CODEX_MODEL ?? "gpt-5.4",
	binaryPath: process.env.CODEX_BINARY_PATH,
	homePath: process.env.CODEX_HOME,
	dbPath: process.env.LUNA_DB_PATH,
	repoRoot: process.env.LUNA_REPO_ROOT ?? process.cwd(),
};

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

function formatDuration(ms: number | null): string {
	if (ms === null || ms < 0) {
		return "--";
	}
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) {
		return `${hours}h ${minutes}m ${seconds}s`;
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}
	if (seconds > 0) {
		return `${seconds}s`;
	}
	return `${ms}ms`;
}

function formatCompactNumber(value: number): string {
	if (value >= 1_000_000) {
		return `${(value / 1_000_000).toFixed(1)}m`;
	}
	if (value >= 1_000) {
		return `${(value / 1_000).toFixed(1)}k`;
	}
	return `${value}`;
}

function formatTokenUsage(usage: ThreadTokenUsageSnapshot | null): string {
	if (!usage) {
		return "--";
	}
	const used = usage.usedTokens;
	const max = usage.maxTokens;
	if (!max || max <= 0) {
		return formatCompactNumber(used);
	}
	const percentage = Math.max(0, Math.min(100, Math.round((used / max) * 100)));
	return `${formatCompactNumber(used)} (${percentage}%)`;
}

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

	// Message area
	const scrollBox = new ScrollBoxRenderable(renderer, {
		flexGrow: 1,
		scrollY: true,
		stickyScroll: true,
		paddingX: 2,
		paddingY: 1,
	});
	renderer.root.add(scrollBox);

	const metaText = new TextRenderable(renderer, {
		content: `  ${env.model}  ·  --`,
		height: 1,
		paddingX: 2,
		fg: theme.muted,
	});
	renderer.root.add(metaText);

	// Input box
	const inputBox = new BoxRenderable(renderer, {
		height: 8,
		border: true,
		borderStyle: "rounded",
		borderColor: theme.border,
		paddingX: 1,
	});
	renderer.root.add(inputBox);

	const input = new TextareaRenderable(renderer, {
		flexGrow: 1,
		placeholder: "Type a message. Enter sends, Shift+Enter adds a newline…",
		wrapMode: "word",
		textColor: theme.text,
		focusedTextColor: theme.text,
		placeholderColor: theme.muted,
		cursorColor: theme.mauve,
		keyBindings: [
			{ name: "return", action: "submit" },
			{ name: "return", shift: true, action: "newline" },
		],
	});
	inputBox.add(input);

	const statusRow = new BoxRenderable(renderer, {
		height: 1,
		flexDirection: "row",
		alignItems: "center",
		paddingX: 2,
	});
	renderer.root.add(statusRow);

	const statusText = new TextRenderable(renderer, {
		content: "",
		fg: theme.muted,
	});
	statusRow.add(statusText);

	const statusSpacer = new BoxRenderable(renderer, { flexGrow: 1 });
	statusRow.add(statusSpacer);

	const tokenText = new TextRenderable(renderer, {
		content: "--",
		fg: theme.muted,
	});
	statusRow.add(tokenText);

	const reasoningEmptyText = new TextRenderable(renderer, {
		content: "No reasoning available for this turn yet.",
		fg: theme.muted,
	});

	const reasoningDialog = new BoxRenderable(renderer, {
		position: "absolute",
		top: "10%",
		left: "10%",
		width: "80%",
		height: "70%",
		zIndex: 10,
		visible: false,
		border: true,
		borderStyle: "rounded",
		borderColor: theme.border,
		backgroundColor: theme.surface,
		flexDirection: "column",
		paddingX: 1,
		paddingY: 1,
	});
	renderer.root.add(reasoningDialog);

	const reasoningTitle = new TextRenderable(renderer, {
		content: "Reasoning  ·  Ctrl+R close",
		height: 1,
		fg: theme.mauve,
		marginBottom: 1,
	});
	reasoningDialog.add(reasoningTitle);

	const reasoningScrollBox = new ScrollBoxRenderable(renderer, {
		flexGrow: 1,
		scrollY: true,
		stickyScroll: true,
	});
	reasoningDialog.add(reasoningScrollBox);

	const reasoningContent = new MarkdownRenderable(renderer, {
		content: "",
		syntaxStyle,
		streaming: true,
	});
	reasoningScrollBox.add(reasoningEmptyText);
	reasoningScrollBox.add(reasoningContent);

	// ── State ─────────────────────────────────────────────────────────────────

	let inputEnabled = false;
	let currentResponse: MarkdownRenderable | null = null;
	let spinnerTimer: ReturnType<typeof setInterval> | undefined;
	let spinnerIdx = 0;
	let lastTurnDurationMs: number | null = null;
	let activeTurnStartedAtMs: number | null = null;
	let latestTokenUsage: ThreadTokenUsageSnapshot | null = null;
	let reasoningOpen = false;

	const updateMetaText = () => {
		const elapsed =
			activeTurnStartedAtMs !== null ? Date.now() - activeTurnStartedAtMs : lastTurnDurationMs;
		metaText.content = `  ${env.model}  ·  ${formatDuration(elapsed)}`;
	};

	const updateTokenText = () => {
		tokenText.content = formatTokenUsage(latestTokenUsage);
	};

	const updateReasoningEmptyState = () => {
		reasoningEmptyText.visible = reasoningContent.content.trim().length === 0;
	};

	const setReasoningOpen = (open: boolean) => {
		reasoningOpen = open;
		reasoningDialog.visible = open;
		reasoningScrollBox.stickyScroll = true;
		updateReasoningEmptyState();
		if (!open) {
			input.focus();
		}
	};

	updateMetaText();
	updateTokenText();
	updateReasoningEmptyState();

	const startSpinner = (label: string) => {
		if (label === "thinking") {
			statusText.content = `${SPINNER_FRAMES[0]} thinking`;
		} else {
			statusText.content = "";
		}
		spinnerTimer = setInterval(() => {
			if (label === "thinking") {
				statusText.content = `${SPINNER_FRAMES[spinnerIdx++ % SPINNER_FRAMES.length]} thinking`;
			}
			updateMetaText();
		}, 80);
	};

	const stopSpinner = () => {
		if (spinnerTimer !== undefined) {
			clearInterval(spinnerTimer);
			spinnerTimer = undefined;
		}
		statusText.content = "";
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

	const finishTurn = (statusColor?: string) => {
		if (activeTurnStartedAtMs !== null) {
			lastTurnDurationMs = Math.max(0, Date.now() - activeTurnStartedAtMs);
			activeTurnStartedAtMs = null;
			updateMetaText();
		}
		if (currentResponse) {
			currentResponse.streaming = false;
			currentResponse = null;
		}
		reasoningContent.streaming = false;
		updateReasoningEmptyState();
		stopSpinner();
		statusText.fg = statusColor ?? theme.muted;
		inputEnabled = true;
		input.focus();
	};

	runtime.on((event) => {
		if (event.type === "turn.started") {
			activeTurnStartedAtMs = Date.now();
			updateMetaText();
			return;
		}
		if (event.type === "content.delta") {
			if (
				event.payload.streamKind === "reasoning_text" ||
				event.payload.streamKind === "reasoning_summary_text" ||
				event.payload.streamKind === "plan_text"
			) {
				reasoningContent.streaming = true;
				reasoningContent.content += event.payload.delta;
				updateReasoningEmptyState();
				reasoningScrollBox.stickyScroll = true;
				return;
			}
			currentResponse ??= addAgentMessage();
			currentResponse.content += event.payload.delta;
			return;
		}
		if (event.type === "thread.token-usage.updated") {
			latestTokenUsage = event.payload.usage;
			updateTokenText();
			return;
		}
		if (event.type === "turn.plan.updated") {
			const explanation =
				typeof event.payload.explanation === "string" ? event.payload.explanation.trim() : "";
			const plan = Array.isArray(event.payload.plan)
				? event.payload.plan
						.map((step) => {
							if (!step || typeof step !== "object") return null;
							const record = step as { step?: unknown; status?: unknown };
							const label = typeof record.step === "string" ? record.step : "step";
							const status = typeof record.status === "string" ? record.status : "pending";
							return `- [${status === "completed" ? "x" : " "}] ${label}`;
						})
						.filter((value): value is string => value !== null)
						.join("\n")
				: "";
			const sections = [explanation, plan].filter((value) => value.length > 0);
			if (sections.length > 0) {
				reasoningContent.content = sections.join("\n\n");
				reasoningContent.streaming = true;
				updateReasoningEmptyState();
				reasoningScrollBox.stickyScroll = true;
			}
			return;
		}
		if (event.type === "turn.completed") {
			finishTurn();
			return;
		}
		if (event.type === "turn.aborted") {
			finishTurn(theme.yellow);
			return;
		}
		if (event.type === "session.error") {
			finishTurn(theme.red);
			return;
		}
		if (event.type === "session.exited") {
			activeTurnStartedAtMs = null;
			updateMetaText();
			if (currentResponse) {
				currentResponse.streaming = false;
				currentResponse = null;
			}
			reasoningContent.streaming = false;
			updateReasoningEmptyState();
			stopSpinner();
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
		reasoningContent.content = "";
		reasoningContent.streaming = true;
		updateReasoningEmptyState();
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
			finishTurn(theme.red);
		}
	}

	input.onSubmit = () => {
		const text = input.plainText.trim();
		if (!text || !inputEnabled) {
			return;
		}
		input.initialValue = "";
		void sendMessage(text);
	};

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

		if (event.ctrl && event.name === "r") {
			setReasoningOpen(!reasoningOpen);
			event.stopPropagation();
			return;
		}

		if (event.ctrl && event.shift && event.name === "c") {
			const selectedText = renderer.getSelection()?.getSelectedText().trim() ?? "";
			if (selectedText) {
				renderer.copyToClipboardOSC52(selectedText);
			}
			event.stopPropagation();
			return;
		}

		if (reasoningOpen && event.name === "escape") {
			setReasoningOpen(false);
			event.stopPropagation();
			return;
		}

		// Keyboard scroll
		if (event.name === "pageup" || (event.shift && event.name === "up")) {
			if (reasoningOpen) {
				reasoningScrollBox.stickyScroll = false;
				reasoningScrollBox.scrollBy(-SCROLL_STEP);
			} else {
				scrollBox.stickyScroll = false;
				scrollBox.scrollBy(-SCROLL_STEP);
			}
			event.stopPropagation();
			return;
		}
		if (event.name === "pagedown" || (event.shift && event.name === "down")) {
			if (reasoningOpen) {
				reasoningScrollBox.scrollBy(SCROLL_STEP);
			} else {
				scrollBox.scrollBy(SCROLL_STEP);
			}
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
		updateMetaText();
		stopSpinner();
		statusText.fg = theme.muted;
		inputEnabled = true;
		input.focus();
	} catch (error) {
		stopSpinner();
		statusText.fg = theme.red;
		metaText.content = `  luna  ·  ${error instanceof Error ? error.message : String(error)}`;
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
