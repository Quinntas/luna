import { parseArgs } from "node:util";
import { createCliRenderer } from "@opentui/core";
import { SLASH_COMMANDS } from "./commands.ts";
import { updateReasoningOptions } from "./dialogs.ts";
import { runSlashCommand, updateCommandMenu, wireInput } from "./input.ts";
import { createLayout } from "./layout.ts";
import { addAgentMessage, addUserMessage } from "./messages.ts";
import {
	createRuntime,
	finishTurn,
	startSpinner,
	stopSpinner,
	updateMetaText,
	updateTokenText,
	wireRuntime,
} from "./runtime.ts";
import { env, theme } from "./theme.ts";
import type { TuiState } from "./types.ts";

export async function runTui(opts: { resume: boolean; threadId?: string }): Promise<void> {
	const renderer = await createCliRenderer({
		useAlternateScreen: true,
		exitOnCtrlC: false,
		useMouse: true,
	});
	const refs = createLayout(renderer);
	const state: TuiState = {
		inputEnabled: false,
		currentResponse: null,
		spinnerTimer: undefined,
		spinnerIdx: 0,
		lastTurnDurationMs: null,
		activeTurnStartedAtMs: null,
		latestTokenUsage: null,
		activeDialog: null,
		reasoningEffort: "low",
		reasoningEffortIdx: 0,
		commandMatches: [],
		commandSelectionIdx: 0,
	};

	const runtime = createRuntime(env.dbPath);
	wireRuntime(runtime, state, refs, env.model);
	updateReasoningOptions(state, refs);
	updateMetaText(state, refs, env.model);
	updateTokenText(state, refs);
	updateCommandMenu(state, refs);

	let thread: Awaited<ReturnType<typeof runtime.startThread>> | undefined;

	async function sendMessage(text: string): Promise<void> {
		if (!thread || !state.inputEnabled) return;
		const slashCommand = SLASH_COMMANDS.find((command) => command.name === text);
		if (slashCommand) {
			runSlashCommand(slashCommand, state, refs);
			return;
		}
		state.inputEnabled = false;
		refs.scrollBox.stickyScroll = true;
		addUserMessage(refs, text);
		state.currentResponse = addAgentMessage(refs);
		startSpinner(state, refs, "thinking", env.model);
		refs.statusText.fg = theme.muted;
		try {
			await runtime.sendMessage({
				threadId: thread.id,
				text,
				interactionMode: "default",
				reasoningEffort: state.reasoningEffort,
			});
		} catch {
			finishTurn(state, refs, env.model, theme.red);
		}
	}

	wireInput({
		state,
		refs,
		runtime,
		getThread: () => thread,
		sendMessage,
	});

	startSpinner(state, refs, "connecting", env.model);

	try {
		if (opts.resume) {
			const threads = await runtime.listThreads();
			const target = opts.threadId
				? threads.find((item) => item.id === opts.threadId)
				: threads.at(-1);
			if (!target) {
				throw new Error("No thread to resume");
			}
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
		updateMetaText(state, refs, env.model);
		stopSpinner(state, refs);
		refs.statusText.fg = theme.muted;
		state.inputEnabled = true;
		refs.input.focus();
	} catch (error) {
		stopSpinner(state, refs);
		refs.statusText.fg = theme.red;
		refs.metaText.content = `  luna  ·  ${error instanceof Error ? error.message : String(error)}`;
	}
}

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
