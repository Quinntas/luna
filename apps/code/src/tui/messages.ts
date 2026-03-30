import { BoxRenderable, TextRenderable } from "@opentui/core";
import { createMarkdownMessage } from "./layout.ts";
import { theme } from "./theme.ts";
import type { TuiRefs } from "./types.ts";

export function addUserMessage(refs: TuiRefs, text: string): void {
	const box = new BoxRenderable(refs.renderer, {
		border: true,
		borderStyle: "rounded",
		borderColor: theme.border,
		title: " You ",
		titleAlignment: "left",
		paddingX: 1,
		marginBottom: 1,
	});
	const msg = new TextRenderable(refs.renderer, {
		content: text,
		fg: theme.text,
	});
	box.add(msg);
	refs.scrollBox.add(box);
}

export function addAgentMessage(refs: TuiRefs) {
	const wrapper = new BoxRenderable(refs.renderer, {
		flexDirection: "column",
		paddingLeft: 1,
		marginBottom: 1,
	});
	const label = new TextRenderable(refs.renderer, {
		content: "luna",
		height: 1,
		fg: theme.mauve,
		marginBottom: 1,
	});
	const md = createMarkdownMessage(refs.renderer);
	wrapper.add(label);
	wrapper.add(md);
	refs.scrollBox.add(wrapper);
	return md;
}

export function clearChatHistory(refs: TuiRefs): void {
	for (const child of refs.scrollBox.getChildren()) {
		refs.scrollBox.remove(child.id);
	}
	refs.renderer.clearSelection();
}
