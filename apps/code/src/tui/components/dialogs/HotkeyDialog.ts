import { TextRenderable } from "@opentui/core";
import { buildHotkeysText } from "../../config/hotkeys.ts";
import { theme } from "../../config/index.ts";
import type { CliRenderer } from "../../types.ts";
import { Dialog } from "./Dialog.ts";

export class HotkeyDialog extends Dialog {
	private title: TextRenderable;
	private content: TextRenderable;

	constructor(renderer: CliRenderer) {
		super(renderer, 11);

		this.title = new TextRenderable(renderer, {
			content: "Hotkeys",
			height: 1,
			fg: theme.mauve,
		});
		this.inner.add(this.title);

		this.content = new TextRenderable(renderer, {
			content: buildHotkeysText(),
			fg: theme.text,
		});
		this.inner.add(this.content);
	}

	render(): void {
		this.content.content = buildHotkeysText();
	}

	handleKey(_event: { name: string; stopPropagation: () => void }): boolean {
		return false;
	}
}
