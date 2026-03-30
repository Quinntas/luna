import { TextRenderable } from "@opentui/core";
import { REASONING_EFFORTS, theme } from "../../config/index.ts";
import type { CliRenderer, TuiState } from "../../types.ts";
import { Dialog } from "./Dialog.ts";

export class ReasonDialog extends Dialog {
	private title: TextRenderable;
	private optionsText: TextRenderable;
	public state: TuiState;

	constructor(renderer: CliRenderer, state: TuiState) {
		super(renderer, 10);
		this.state = state;

		this.title = new TextRenderable(renderer, {
			content: "Reasoning Effort",
			height: 1,
			fg: theme.mauve,
		});
		this.inner.add(this.title);

		this.optionsText = new TextRenderable(renderer, {
			content: "",
			fg: theme.text,
		});
		this.inner.add(this.optionsText);
	}

	render(): void {
		this.optionsText.content = REASONING_EFFORTS.map((effort, idx) => {
			const selected = idx === this.state.reasoningEffortIdx;
			const applied = effort === this.state.reasoningEffort ? " (current)" : "";
			return `${selected ? "›" : " "} ${effort}${applied}`;
		}).join("\n");
	}

	handleKey(event: { name: string; stopPropagation: () => void }): boolean {
		if (event.name === "up" || event.name === "k") {
			this.state.reasoningEffortIdx =
				(this.state.reasoningEffortIdx - 1 + REASONING_EFFORTS.length) % REASONING_EFFORTS.length;
			this.render();
			event.stopPropagation();
			return true;
		}
		if (event.name === "down" || event.name === "j") {
			this.state.reasoningEffortIdx =
				(this.state.reasoningEffortIdx + 1) % REASONING_EFFORTS.length;
			this.render();
			event.stopPropagation();
			return true;
		}
		if (event.name === "return") {
			this.state.reasoningEffort =
				REASONING_EFFORTS[this.state.reasoningEffortIdx] ?? this.state.reasoningEffort;
			this.render();
			this.hide();
			event.stopPropagation();
			return true;
		}
		return false;
	}
}

export function createReasonDialog(renderer: CliRenderer, state: TuiState): ReasonDialog {
	return new ReasonDialog(renderer, state);
}
