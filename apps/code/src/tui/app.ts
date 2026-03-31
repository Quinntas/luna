import { parseArgs } from "node:util";
import { createModel } from "@luna/ai";
import { createCliRenderer } from "@opentui/core";
import { generateText, type LanguageModel } from "ai";
import { generateThreadTitleWithModel } from "./commands/threadName.ts";
import { createDialogManager } from "./components/dialogs/index.ts";
import { createLayout } from "./components/Layout.ts";
import { addAgentMessage, addUserMessage, loadHistory } from "./components/Messages.ts";
import { loadProjectStatus, loadSidebarThreads, updateSidebar } from "./components/Sidebar.ts";
import { env, theme } from "./config/index.ts";
import { SLASH_COMMANDS } from "./input/commands.ts";
import { runSlashCommand, updateCommandMenu, wireInput } from "./input/index.ts";
import {
	finishTurn,
	startSpinner,
	stopSpinner,
	updateMetaText,
	updateTokenText,
	wireRuntime,
} from "./runtime/events.ts";
import { createRuntime } from "./runtime/factory.ts";
import type { HistoryEntry } from "./types.ts";
import { createInitialState } from "./types.ts";

function sanitizeWorktreeName(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 40);
}

async function generateWorktreeName(message: string, model: LanguageModel): Promise<string> {
	const prompt = `Generate a short, descriptive branch name (2-4 words max) in kebab-case for a git branch based on this user request. Only respond with the branch name, nothing else.

User request: ${message}

Branch name:`;

	const { text } = await generateText({
		model,
		prompt,
	});
	return sanitizeWorktreeName(text.trim());
}

export async function runTui(opts: { resume: boolean; threadId?: string }): Promise<void> {
	const renderer = await createCliRenderer({
		useAlternateScreen: true,
		exitOnCtrlC: false,
		useMouse: true,
		useConsole: false,
		openConsoleOnError: false,
	});
	const refs = createLayout(renderer);
	const state = createInitialState();
	const dialogManager = createDialogManager(refs, state);

	const runtime = createRuntime(env.dbPath);
	const aiModel = createModel(env.AI_PROVIDER, env.AI_MODEL);

	async function saveHistory(): Promise<void> {
		if (thread) {
			await runtime.updateHistory(thread.id, state.history);
		}
	}

	wireRuntime(runtime, state, refs, env.model, saveHistory);
	dialogManager.updateReasoning();
	const initialMode = state.worktreeMode ? "worktree" : "repo";
	updateMetaText(state, refs, env.model, initialMode);
	updateTokenText(state, refs);
	updateCommandMenu(state, refs);

	let thread: Awaited<ReturnType<typeof runtime.startThread>> | undefined;

	async function ensureThread(): Promise<void> {
		if (thread) return;
		const threadId = `thread-${Date.now()}`;
		const worktreeMode = state.worktreeMode ? "reuse-or-create" : "repo-root";
		thread = await runtime.startThread({
			threadId,
			title: "New thread",
			repoRoot: env.repoRoot,
			worktree: { mode: worktreeMode },
			codex: {
				model: env.model,
				runtimeMode: "full-access",
				binaryPath: env.binaryPath,
				homePath: env.homePath,
			},
		});

		const threadRecord = await runtime.getThread(thread.id);
		if (!threadRecord) return;

		state.threadTitle = threadRecord.title;
		state.currentThreadId = threadRecord.id;
		state.currentBranch = threadRecord.workspace.branch;
		state.currentWorktreePath = threadRecord.workspace.worktreePath;
		state.currentCwd = threadRecord.workspace.cwd;
		state.worktreeMode = threadRecord.workspace.mode === "worktree";

		if (state.sidebarVisible) {
			const repoName = threadRecord.repoRoot.split("/").at(-1) ?? threadRecord.repoRoot;
			const existingProject = state.sidebarProjects.find((p) => p.name === repoName);
			const newThread = {
				id: threadRecord.id,
				title: threadRecord.title,
				branch: threadRecord.workspace.branch,
				mode: threadRecord.workspace.mode,
				repoRoot: threadRecord.repoRoot,
				createdAt: threadRecord.createdAt,
				updatedAt: threadRecord.updatedAt,
			};

			if (existingProject) {
				existingProject.threads.unshift(newThread);
				existingProject.expanded = true;
			} else {
				state.sidebarProjects.unshift({
					name: repoName,
					threads: [newThread],
					expanded: true,
					currentBranch: threadRecord.workspace.branch ?? "main",
				});
			}
			state.selectedProjectIdx = 0;
			state.selectedThreadIdx = 0;
			state.sidebarMode = "threads";
			const currentProject = state.sidebarProjects[state.selectedProjectIdx];
			if (currentProject) {
				await loadProjectStatus(currentProject);
			}
			updateSidebar(state, refs);
		}

		const modeLabel = state.worktreeMode ? "worktree" : "repo";
		updateMetaText(state, refs, env.model, modeLabel);
	}

	async function sendMessage(text: string): Promise<void> {
		if (!state.inputEnabled) return;
		const slashCommand = SLASH_COMMANDS.find((command) => command.name === text);
		if (slashCommand) {
			runSlashCommand(slashCommand, state, refs, dialogManager, runtime, aiModel, (model, mode) => {
				updateMetaText(state, refs, model, mode);
			});
			return;
		}

		if (state.pendingWorktree) {
			const { repoRoot, mainBranch, threadId } = state.pendingWorktree;
			refs.statusText.content = "Generating worktree name...";

			let worktreeName: string;
			try {
				worktreeName = await generateWorktreeName(text, aiModel);
				if (!worktreeName) {
					worktreeName = sanitizeWorktreeName(text);
				}
			} catch {
				worktreeName = sanitizeWorktreeName(text);
			}

			refs.statusText.content = "Creating worktree...";

			const workThread = await runtime.startThread({
				threadId,
				title: worktreeName,
				repoRoot,
				worktree: {
					mode: "reuse-or-create",
					branch: mainBranch,
					preferredBranchName: worktreeName,
				},
				codex: {
					model: env.model,
					runtimeMode: "full-access",
					binaryPath: env.binaryPath,
					homePath: env.homePath,
				},
			});

			const threadRecord = await runtime.getThread(workThread.id);
			if (threadRecord) {
				state.currentThreadId = threadRecord.id;
				state.currentBranch = threadRecord.workspace.branch;
				state.currentWorktreePath = threadRecord.workspace.worktreePath;
				state.currentCwd = threadRecord.workspace.cwd;
				state.worktreeMode = true;
				state.threadTitle = threadRecord.title;
				state.pendingWorktree = null;

				if (state.sidebarVisible) {
					state.sidebarProjects = await loadSidebarThreads(runtime);
					updateSidebar(state, refs);
				}

				const modeLabel = state.worktreeMode ? "worktree" : "repo";
				updateMetaText(state, refs, env.model, modeLabel);
			}
		}

		await ensureThread();
		if (!thread) return;
		state.inputEnabled = false;
		refs.scrollBox.stickyScroll = true;
		addUserMessage(refs, text);
		state.currentResponse = addAgentMessage(refs);
		const userEntry: HistoryEntry = { role: "user", content: text };
		state.history = [userEntry, ...state.history];
		state.historyIndex = -1;

		if (state.history.length === 1) {
			state.threadTitle = "New thread";
			const currentThreadId = thread.id;
			generateThreadTitleWithModel(text, aiModel).then(async (title) => {
				await runtime.updateThreadTitle(currentThreadId, title);
				state.threadTitle = title;
				if (state.sidebarVisible) {
					state.sidebarProjects = await loadSidebarThreads(runtime);
					updateSidebar(state, refs);
				}
			});
		}

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
		dialogManager,
		model: aiModel,
	});

	if (opts.resume) {
		startSpinner(state, refs, "connecting", env.model);
		try {
			const threads = await runtime.listThreads();
			const target = opts.threadId
				? threads.find((item) => item.id === opts.threadId)
				: threads.at(-1);
			if (!target) {
				throw new Error("No thread to resume");
			}
			thread = await runtime.resumeThread(target.id);
			const threadRecord = await runtime.getThread(thread.id);
			if (threadRecord) {
				if (threadRecord.history && threadRecord.history.length > 0) {
					state.history = [...threadRecord.history];
				} else if ((threadRecord as unknown as { inputHistory?: string[] }).inputHistory) {
					const oldInputHistory = (threadRecord as unknown as { inputHistory: string[] })
						.inputHistory;
					state.history = oldInputHistory.map((content) => ({
						role: "user" as const,
						content,
					}));
				}
				state.worktreeMode = threadRecord.workspace.mode === "worktree";
				state.threadTitle = threadRecord.title;
				loadHistory(refs, state.history);
			}
			const modeLabel = state.worktreeMode ? "worktree" : "repo";
			updateMetaText(state, refs, env.model, modeLabel);
			stopSpinner(state, refs);
			refs.statusText.fg = theme.muted;
			state.inputEnabled = true;
			refs.input.focus();
		} catch (error) {
			stopSpinner(state, refs);
			refs.statusText.fg = theme.red;
			refs.metaText.content = `${error instanceof Error ? error.message : String(error)}`;
		}
	} else {
		state.inputEnabled = true;
		refs.input.focus();
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
