import type { TuiRefs, TuiState } from "../../types.ts";
import { HotkeyDialog } from "./HotkeyDialog.ts";
import { createReasonDialog, type ReasonDialog } from "./ReasonDialog.ts";

export { Dialog } from "./Dialog.ts";
export { HotkeyDialog } from "./HotkeyDialog.ts";
export { createReasonDialog, ReasonDialog } from "./ReasonDialog.ts";

export interface DialogManager {
	reasonDialog: ReasonDialog;
	hotkeyDialog: HotkeyDialog;
	setActive(dialog: TuiState["activeDialog"]): void;
	updateReasoning(): void;
}

export function createDialogManager(refs: TuiRefs, state: TuiState): DialogManager {
	const reasonDialog = createReasonDialog(refs.renderer, state);
	const hotkeyDialog = new HotkeyDialog(refs.renderer);

	return {
		reasonDialog,
		hotkeyDialog,
		setActive(dialog) {
			state.activeDialog = dialog;
			reasonDialog.hide();
			hotkeyDialog.hide();
			if (dialog === "reasoning") {
				reasonDialog.show();
				this.updateReasoning();
			} else if (dialog === "hotkeys") {
				hotkeyDialog.show();
			} else {
				refs.input.focus();
			}
		},
		updateReasoning() {
			reasonDialog.render();
		},
	};
}
