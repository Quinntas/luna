import type { LanguageModel } from "ai";
import type { LunaRuntime } from "../../index.ts";
import { updateSidebar } from "../components/Sidebar.ts";
import type { DialogManager } from "../components/dialogs/index.ts";
import type { TuiRefs, TuiState } from "../types.ts";
import {
	applySelectedCommand,
	handleKeyPress,
	handlePaste,
	updateCommandMenu,
} from "./keyboard.ts";

export function wireInput(options: {
	state: TuiState;
	refs: TuiRefs;
	runtime: LunaRuntime;
	getThread: () => unknown;
	sendMessage: (text: string) => Promise<void>;
	dialogManager: DialogManager;
	model: LanguageModel;
}): void {
	const { state, refs, runtime, getThread, sendMessage, dialogManager, model } = options;

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

	// Capture text selection from chat history
	refs.renderer.on("selection", (selection: { getSelectedText?: () => string } | null) => {
		const text = selection?.getSelectedText?.() ?? null;
		state.selectedHistoryText = text || null;
	});

	// Sidebar mouse click: map click y-position to thread index and switch
	refs.sidebar.onMouseDown = (e) => {
		e.preventDefault();
		if (!state.sidebarVisible || state.sidebarThreads.length === 0) return;
		// Each item takes 2 rows (name + description with showDescription: true)
		const clickedIdx = Math.floor(e.y / 2);
		const clampedIdx = Math.max(0, Math.min(state.sidebarThreads.length - 1, clickedIdx));
		state.selectedThreadIdx = clampedIdx;
		refs.sidebar.setSelectedIndex(clampedIdx);
		updateSidebar(state, refs);
	};

	refs.renderer.keyInput.on("paste", (event: { bytes: Uint8Array; stopPropagation: () => void }) => {
		handlePaste(event, state, refs);
	});

	refs.renderer.keyInput.on("keypress", (event) => {
		handleKeyPress(event, state, refs, runtime, getThread, sendMessage, dialogManager, model);
	});
}
