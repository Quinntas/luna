import type { KeyEvent } from "@opentui/core";
import type { LunaRuntime } from "../index.ts";
import { SLASH_COMMANDS } from "./commands.ts";
import { setActiveDialog, updateReasoningOptions } from "./dialogs.ts";
import { getSlashQuery } from "./format.ts";
import { clearChatHistory } from "./messages.ts";
import { env, REASONING_EFFORTS, SCROLL_STEP, textDecoder } from "./theme.ts";
import type { SlashCommand, TuiRefs, TuiState } from "./types.ts";

export function updateCommandMenu(state: TuiState, refs: TuiRefs): void {
	const query = getSlashQuery(refs.input.plainText);
	if (query === null) {
		state.commandMatches = [];
		state.commandSelectionIdx = 0;
		refs.commandMenu.visible = false;
		refs.commandMenuText.content = "";
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

	state.commandSelectionIdx = Math.max(0, Math.min(state.commandSelectionIdx, state.commandMatches.length - 1));
	refs.commandMenu.visible = true;
	refs.metaText.visible = false;

	const maxLen = Math.max(...availableCommands.map((c) => c.name.length));
	refs.commandMenuText.content = availableCommands
		.map((command) => {
			if (!state.commandMatches.includes(command)) {
				return "";
			}
			const selected = command === state.commandMatches[state.commandSelectionIdx];
			return `${selected ? "›" : " "} ${command.name.padEnd(maxLen)}  ${command.description}`;
		})
		.join("\n");
}

export function applySelectedCommand(state: TuiState, refs: TuiRefs): SlashCommand | null {
	const selected = state.commandMatches[state.commandSelectionIdx];
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
	updateMeta: (model: string, mode: string) => void,
): boolean {
	if (command.action === "hotkeys") {
		setActiveDialog(state, refs, "hotkeys");
		return true;
	}
	if (command.action === "reasoning") {
		setActiveDialog(state, refs, "reasoning");
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
	return false;
}

export function wireInput(options: {
	state: TuiState;
	refs: TuiRefs;
	runtime: LunaRuntime;
	getThread: () => Awaited<ReturnType<LunaRuntime["startThread"]>> | undefined;
	sendMessage: (text: string) => Promise<void>;
}): void {
	const { state, refs, runtime, getThread, sendMessage } = options;

	refs.input.onSubmit = () => {
		const text = refs.input.plainText.trim();
		if (!text || !state.inputEnabled) {
			return;
		}
		if (refs.commandMenu.visible) {
			const selected = applySelectedCommand(state, refs);
			if (selected) {
				refs.input.clear();
				updateCommandMenu(state, refs);
				void sendMessage(selected.name);
			}
			return;
		}
		refs.input.clear();
		updateCommandMenu(state, refs);
		void sendMessage(text);
	};

	refs.input.onContentChange = () => {
		updateCommandMenu(state, refs);
		const lineCount = (refs.input.plainText.match(/\n/g) || []).length + 1;
		const newHeight = Math.min(Math.max(lineCount + 1, 4), 6);
		refs.inputBox.height = newHeight;
	};

	refs.renderer.keyInput.on("paste", (event) => {
		if (state.activeDialog !== null || !state.inputEnabled) {
			return;
		}
		refs.input.focus();
		refs.input.insertText(textDecoder.decode(event.bytes));
		updateCommandMenu(state, refs);
		event.stopPropagation();
	});

	refs.renderer.keyInput.on("keypress", (event: KeyEvent) => {
		if (event.ctrl && event.name === "c") {
			void (async () => {
				try {
					const thread = getThread();
					if (thread) {
						await runtime.stopThread(thread.id);
					}
				} catch {}
				runtime.dispose();
				refs.renderer.destroy();
				process.exit(0);
			})();
			return;
		}

		if (event.ctrl && event.name === "r") {
			setActiveDialog(state, refs, state.activeDialog === "reasoning" ? null : "reasoning");
			updateReasoningOptions(state, refs);
			event.stopPropagation();
			return;
		}

		if ((event.ctrl && event.name === "slash") || event.name === "f1") {
			setActiveDialog(state, refs, state.activeDialog === "hotkeys" ? null : "hotkeys");
			event.stopPropagation();
			return;
		}

		if (refs.commandMenu.visible && state.activeDialog === null) {
			if (event.name === "up" || event.name === "k") {
				if (state.commandMatches.length > 0) {
					state.commandSelectionIdx =
						(state.commandSelectionIdx - 1 + state.commandMatches.length) %
						state.commandMatches.length;
					updateCommandMenu(state, refs);
				}
				event.stopPropagation();
				return;
			}
			if (event.name === "down" || event.name === "j") {
				if (state.commandMatches.length > 0) {
					state.commandSelectionIdx = (state.commandSelectionIdx + 1) % state.commandMatches.length;
					updateCommandMenu(state, refs);
				}
				event.stopPropagation();
				return;
			}
			if (event.name === "tab") {
				const selected = applySelectedCommand(state, refs);
				if (selected) {
					refs.input.clear();
					updateCommandMenu(state, refs);
					void sendMessage(selected.name);
				}
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

		if (
			(event.ctrl && event.shift && event.name === "c") ||
			(event.meta && event.name === "c") ||
			(event.meta && event.name === "insert") ||
			(event.meta && event.name === "i") ||
			(event.option && event.name === "c")
		) {
			const textToCopy = refs.input.getSelectedText();
			if (textToCopy) {
				refs.renderer.copyToClipboardOSC52(textToCopy);
			}
			event.stopPropagation();
			return;
		}

		if (state.activeDialog !== null && event.name === "escape") {
			setActiveDialog(state, refs, null);
			event.stopPropagation();
			return;
		}

		if (refs.commandMenu.visible && event.name === "escape") {
			refs.input.clear();
			updateCommandMenu(state, refs);
			event.stopPropagation();
			return;
		}

		if (state.activeDialog === "reasoning") {
			if (event.name === "up" || event.name === "k") {
				state.reasoningEffortIdx =
					(state.reasoningEffortIdx - 1 + REASONING_EFFORTS.length) % REASONING_EFFORTS.length;
				updateReasoningOptions(state, refs);
				event.stopPropagation();
				return;
			}
			if (event.name === "down" || event.name === "j") {
				state.reasoningEffortIdx = (state.reasoningEffortIdx + 1) % REASONING_EFFORTS.length;
				updateReasoningOptions(state, refs);
				event.stopPropagation();
				return;
			}
			if (event.name === "return") {
				state.reasoningEffort =
					REASONING_EFFORTS[state.reasoningEffortIdx] ?? state.reasoningEffort;
				updateReasoningOptions(state, refs);
				setActiveDialog(state, refs, null);
				event.stopPropagation();
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
	});
}
