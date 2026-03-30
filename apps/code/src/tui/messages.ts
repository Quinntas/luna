import { BoxRenderable, TextRenderable } from "@opentui/core";
import { createMarkdownMessage } from "./layout.ts";
import { theme } from "./theme.ts";
import type { TuiRefs } from "./types.ts";

export function addUserMessage(refs: TuiRefs, text: string): void {
	const wrapper = new BoxRenderable(refs.renderer, {
    flexDirection: "column",
    marginBottom: 1
	});
	const label = new TextRenderable(refs.renderer, {
		content: "you",
		height: 1,
		fg: theme.sky,
	});
	const msg = new TextRenderable(refs.renderer, {
		content: text,
		fg: theme.text,
	});
	wrapper.add(label);
	wrapper.add(msg);
	refs.scrollBox.add(wrapper);
}

export function addAgentMessage(refs: TuiRefs) {
	const wrapper = new BoxRenderable(refs.renderer, {
		flexDirection: "column",
    marginBottom: 1
	});
	const label = new TextRenderable(refs.renderer, {
		content: "luna",
		height: 1,
		fg: theme.mauve,
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
