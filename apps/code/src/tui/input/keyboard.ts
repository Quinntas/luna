import { spawn } from "node:child_process";
import type { KeyEvent } from "@opentui/core";
import type { LanguageModel } from "ai";
import type { LunaRuntime } from "../../index.ts";
import { runPrCommand } from "../commands/pr.ts";
import type { DialogManager } from "../components/dialogs/index.ts";
import { clearChatHistory, loadHistory } from "../components/Messages.ts";
import {
	getSelectedThreadId,
	handleSidebarNavigation,
	toggleSidebar,
} from "../components/Sidebar.ts";
import { env, SCROLL_STEP } from "../config/index.ts";
import { updateMetaText } from "../runtime/events.ts";
import type { SlashCommand, TuiRefs, TuiState } from "../types.ts";
import { getSlashQuery } from "../utils/index.ts";
import { SLASH_COMMANDS } from "./commands.ts";

async function execGit(
	cmd: string,
	args: string[],
	cwd: string,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
	return new Promise((resolve) => {
		const child = spawn(cmd, args, {
			cwd,
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
		child.on("error", (err) => {
			resolve({ stdout, stderr: err.message, code: -1 });
		});
		child.on("close", (code) => {
			resolve({ stdout, stderr, code });
		});
	});
}

async function getCurrentBranch(cwd: string): Promise<string | null> {
	const result = await execGit("git", ["branch", "--show-current"], cwd);
	return result.stdout.trim() || null;
}

async function runNewThreadCommand(
	state: TuiState,
	refs: TuiRefs,
	runtime: LunaRuntime,
	repoRoot: string,
): Promise<void> {
	refs.statusText.content = "Creating new thread... (type your first message to name the worktree)";

	const mainBranch = await getCurrentBranch(repoRoot);
	if (!mainBranch) {
		refs.statusText.content = "Error: Not on a branch in main repo";
		return;
	}

	const threadId = `thread-${Date.now()}`;
	const tempWorktreeName = `worktree-${Date.now()}`;

	state.currentThreadId = threadId;
	state.currentBranch = mainBranch;
	state.currentWorktreePath = null;
	state.currentCwd = repoRoot;
	state.worktreeMode = true;
	state.threadTitle = "New thread";
	state.history = [];
	state.historyIndex = -1;
	state.pendingWorktree = {
		repoRoot,
		mainBranch,
		threadId,
	};

	clearChatHistory(refs);
	refs.input.focus();
	refs.statusText.content = "Type your first message to create worktree...";
}

export function updateCommandMenu(state: TuiState, refs: TuiRefs): void {
	const query = getSlashQuery(refs.input.plainText);
	if (query === null) {
		state.commandMatches = [];
		state.commandSelectionIdx = 0;
		refs.commandMenu.visible = false;
		refs.metaText.visible = true;
		return;
	}

	const normalizedQuery = query.toLowerCase();
	const hasUserMessages = state.history.some((h) => h.role === "user");

	const availableCommands = SLASH_COMMANDS.filter((command) => {
		if (command.action === "mode" && hasUserMessages) {
			return false;
		}
		return true;
	});

	state.commandMatches = availableCommands.filter((command) =>
		command.name.slice(1).startsWith(normalizedQuery),
	);

	// If no matches, hide menu
	if (state.commandMatches.length === 0) {
		refs.commandMenu.visible = false;
		refs.metaText.visible = true;
		return;
	}

	// Reset selection when matches change
	state.commandSelectionIdx = 0;

	refs.commandMenu.visible = true;
	refs.metaText.visible = false;

	// Update SelectRenderable options
	refs.commandMenu.options = state.commandMatches.map((cmd) => ({
		name: cmd.name,
		description: cmd.description,
		value: cmd,
	}));

	// Set selection to 0
	refs.commandMenu.setSelectedIndex(0);
}

export function applySelectedCommand(state: TuiState, refs: TuiRefs): SlashCommand | null {
	const idx = refs.commandMenu.getSelectedIndex();
	const selected = state.commandMatches[idx];
	if (!selected) {
		return null;
	}
	refs.input.setText(selected.name);
	updateCommandMenu(state, refs);
	return selected;
}

export function runSlashCommand(
	command: SlashCommand,
	state: TuiState,
	refs: TuiRefs,
	dialogManager: DialogManager,
	runtime: LunaRuntime,
	model: LanguageModel,
	updateMeta: (model: string, mode: string) => void,
): boolean {
	if (command.action === "hotkeys") {
		dialogManager.setActive("hotkeys");
		return true;
	}
	if (command.action === "reasoning") {
		dialogManager.setActive("reasoning");
		return true;
	}
	if (command.action === "mode") {
		const userHasMessages = state.history.some((h) => h.role === "user");
		if (userHasMessages) {
			refs.statusText.content = "Cannot change mode after messages sent";
			return true;
		}
		state.worktreeMode = !state.worktreeMode;
		const modeLabel = state.worktreeMode ? "worktree" : "repo";
		updateMeta(env.model, modeLabel);
		return true;
	}
	if (command.action === "clear") {
		clearChatHistory(refs);
		return true;
	}
	if (command.action === "new") {
		void runNewThreadCommand(state, refs, runtime, env.repoRoot);
		return true;
	}
	if (command.action === "pr") {
		void runPrCommand(state, refs, runtime, model);
		return true;
	}
	return false;
}

export function handleKeyPress(
	event: KeyEvent,
	state: TuiState,
	refs: TuiRefs,
	runtime: LunaRuntime,
	getThread: () => unknown,
	sendMessage: (text: string) => Promise<void>,
	dialogManager: DialogManager,
	model: LanguageModel,
): void {
	if (event.ctrl && event.name === "c") {
		void (async () => {
			try {
				const thread = getThread();
				if (thread) {
					await runtime.stopThread((thread as { id: string }).id);
				}
			} catch {}
			runtime.dispose();
			refs.renderer.destroy();
			process.exit(0);
		})();
		return;
	}

	if (event.ctrl && event.name === "r") {
		dialogManager.setActive(state.activeDialog === "reasoning" ? null : "reasoning");
		dialogManager.updateReasoning();
		event.stopPropagation();
		return;
	}

	if ((event.ctrl && event.name === "slash") || event.name === "f1") {
		dialogManager.setActive(state.activeDialog === "hotkeys" ? null : "hotkeys");
		event.stopPropagation();
		return;
	}

	// Ctrl+b: toggle sidebar
	if (event.ctrl && event.name === "b") {
		void toggleSidebar(state, refs, runtime);
		event.stopPropagation();
		return;
	}

	// Sidebar navigation
	if (state.sidebarVisible) {
		if (handleSidebarNavigation(state, refs, event.name, event.shift)) {
			event.stopPropagation();
			return;
		}
		if (event.name === "escape") {
			state.sidebarVisible = false;
			refs.sidebar.visible = false;
			refs.input.focus();
			event.stopPropagation();
			return;
		}
		if (event.name === "return") {
			event.preventDefault?.();
			event.stopPropagation();
			const threadId = getSelectedThreadId(state);
			if (threadId) {
				refs.sidebar.blur();
				void (async () => {
					try {
						refs.statusText.content = "Switching to thread...";
						state.sidebarVisible = false;
						refs.sidebar.visible = false;
						refs.sidebarContainer.width = 0;

						const threadRecord = await runtime.getThread(threadId);
						if (threadRecord?.history) {
							state.history = [...threadRecord.history];
							loadHistory(refs, state.history);
						}
						state.worktreeMode = threadRecord?.workspace.mode === "worktree";
						state.currentThreadId = threadRecord?.id ?? null;
						state.currentBranch = threadRecord?.workspace.branch ?? null;
						state.currentWorktreePath = threadRecord?.workspace.worktreePath ?? null;
						state.currentCwd = threadRecord?.workspace.cwd ?? "";

						const targetBranch = threadRecord?.workspace.branch;
						const targetCwd = threadRecord?.workspace.cwd ?? env.repoRoot;

						if (targetBranch) {
							const currentBranch = await getCurrentBranch(targetCwd);
							if (currentBranch !== targetBranch) {
								refs.statusText.content = `Switching to branch: ${targetBranch}...`;
								const checkoutResult = await execGit("git", ["checkout", targetBranch], targetCwd);
								if (checkoutResult.code !== 0) {
									refs.statusText.content = `Warning: Failed to switch branch: ${checkoutResult.stderr}`;
								}
							}
						}

						const modeLabel = state.worktreeMode ? "worktree" : "repo";
						updateMetaText(state, refs, env.model, modeLabel);

						refs.statusText.content = "";
						refs.input.focus();
					} catch (error) {
						refs.statusText.content = `Error: ${error instanceof Error ? error.message : String(error)}`;
					}
				})();
				return;
			}
			return;
		}
	}

	// Let SelectRenderable handle up/down when visible
	if (refs.commandMenu.visible && state.activeDialog === null) {
		// If user presses Tab, enter, or special keys, handle selection
		if (event.name === "tab" || event.name === "return") {
			const selected = applySelectedCommand(state, refs);
			if (selected) {
				refs.input.clear();
				updateCommandMenu(state, refs);
				void sendMessage(selected.name);
			}
			event.stopPropagation();
			return;
		}

		// Handle arrow keys for navigation
		if (event.name === "up" || event.name === "k") {
			refs.commandMenu.moveUp();
			event.stopPropagation();
			return;
		}
		if (event.name === "down" || event.name === "j") {
			refs.commandMenu.moveDown();
			event.stopPropagation();
			return;
		}

		// Let the select handle arrow keys unless it's at boundary and we want to exit
		if (event.name === "escape") {
			refs.input.clear();
			updateCommandMenu(state, refs);
			event.stopPropagation();
			return;
		}
	}

	if (!refs.commandMenu.visible && state.activeDialog === null && state.inputEnabled) {
		const userMessages = state.history.filter((h) => h.role === "user");
		if (event.name === "up") {
			if (state.historyIndex < userMessages.length - 1) {
				state.historyIndex++;
				const historyItem = userMessages[state.historyIndex];
				if (historyItem !== undefined) {
					refs.input.setText(historyItem.content);
				}
			}
			event.stopPropagation();
			return;
		}
		if (event.name === "down") {
			if (state.historyIndex > -1) {
				state.historyIndex--;
				if (state.historyIndex === -1) {
					refs.input.clear();
				} else {
					const historyItem = userMessages[state.historyIndex];
					if (historyItem !== undefined) {
						refs.input.setText(historyItem.content);
					}
				}
			}
			event.stopPropagation();
			return;
		}
	}

	// Block Meta+I which opens inspector in some terminals
	if (event.meta && event.name === "i") {
		event.stopPropagation();
		return;
	}

	if (
		(event.ctrl && event.shift && event.name === "c") ||
		(event.meta && event.name === "c") ||
		(event.meta && event.name === "insert") ||
		(event.option && event.name === "c")
	) {
		const inputText = refs.input.getSelectedText();
		const historyText = state.selectedHistoryText;

		if (inputText) {
			refs.renderer.copyToClipboardOSC52(inputText);
			refs.statusText.content = "Copied!";
		} else if (historyText) {
			refs.renderer.copyToClipboardOSC52(historyText);
			refs.statusText.content = "Copied!";
		} else {
			refs.statusText.content = "Select text to copy";
		}

		setTimeout(() => {
			refs.statusText.content = "";
		}, 2000);

		event.stopPropagation();
		return;
	}

	if (state.activeDialog !== null && event.name === "escape") {
		dialogManager.setActive(null);
		event.stopPropagation();
		return;
	}

	if (state.activeDialog === "reasoning") {
		if (dialogManager.reasonDialog.handleKey(event)) {
			return;
		}
	}

	if (event.name === "pageup" || (event.shift && event.name === "up")) {
		refs.scrollBox.stickyScroll = false;
		refs.scrollBox.scrollBy(-SCROLL_STEP);
		event.stopPropagation();
		return;
	}
	if (event.name === "pagedown" || (event.shift && event.name === "down")) {
		refs.scrollBox.scrollBy(SCROLL_STEP);
		event.stopPropagation();
		return;
	}
}

const textDecoder = new TextDecoder();

export function handlePaste(
	event: { bytes: Uint8Array; stopPropagation: () => void },
	state: TuiState,
	refs: TuiRefs,
): void {
	if (state.activeDialog !== null || !state.inputEnabled) {
		return;
	}
	refs.input.focus();
	refs.input.insertText(textDecoder.decode(event.bytes));
	updateCommandMenu(state, refs);
	event.stopPropagation();
}
