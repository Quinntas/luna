import { REASONING_EFFORTS } from "./theme.ts";
import type { ActiveDialog, TuiRefs, TuiState } from "./types.ts";

export function updateReasoningOptions(state: TuiState, refs: TuiRefs): void {
	refs.reasoningOptions.content = REASONING_EFFORTS.map((effort, idx) => {
		const selected = idx === state.reasoningEffortIdx;
		const applied = effort === state.reasoningEffort ? " (current)" : "";
		return `${selected ? "›" : " "} ${effort}${applied}`;
	}).join("\n\n");
}

export function setActiveDialog(state: TuiState, refs: TuiRefs, dialog: ActiveDialog): void {
	state.activeDialog = dialog;
	refs.reasoningDialog.visible = dialog === "reasoning";
	refs.hotkeysDialog.visible = dialog === "hotkeys";
	if (dialog === null) {
		refs.input.focus();
	}
}
