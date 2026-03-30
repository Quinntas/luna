import type { KeyEvent } from "@opentui/core";
import type { LunaRuntime } from "../../index.ts";
import type { DialogManager } from "../components/dialogs/index.ts";
import { clearChatHistory } from "../components/Messages.ts";
import { env, SCROLL_STEP } from "../config/index.ts";
import type { SlashCommand, TuiRefs, TuiState } from "../types.ts";
import { getSlashQuery } from "../utils/index.ts";
import { SLASH_COMMANDS } from "./commands.ts";

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
