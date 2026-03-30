import { BoxRenderable } from "@opentui/core";
import { theme } from "../../config/index.ts";
import type { CliRenderer } from "../../types.ts";

export abstract class Dialog {
	protected root: BoxRenderable;
	protected inner: BoxRenderable;
	protected visible: boolean = false;

	constructor(
		protected renderer: CliRenderer,
		protected zIndex: number,
		protected bg?: string,
	) {
		this.root = new BoxRenderable(renderer, {
			position: "absolute",
			alignItems: "center",
			alignSelf: "center",
			justifyContent: "center",
			height: "100%",
			width: "100%",
			zIndex: this.zIndex,
			visible: false,
		});

		this.inner = new BoxRenderable(renderer, {
			backgroundColor: this.bg,
			border: true,
			borderColor: theme.mauve,
			flexDirection: "column",
		});

		this.root.add(this.inner);
		this.renderer.root.add(this.root);
	}

	show(): void {
		this.visible = true;
		this.root.visible = true;
	}

	hide(): void {
		this.visible = false;
		this.root.visible = false;
	}

	isVisible(): boolean {
		return this.visible;
	}

	abstract render(): void;

	abstract handleKey(event: unknown): boolean;
}
