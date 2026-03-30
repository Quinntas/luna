import {
	BoxRenderable,
	MarkdownRenderable,
	ScrollBoxRenderable,
	TextareaRenderable,
	TextRenderable,
} from "@opentui/core";
import { buildHotkeysText } from "./commands.ts";
import { createSyntaxStyle, env, theme } from "./theme.ts";
import type { CliRenderer, TuiRefs } from "./types.ts";

function createOverlayDialog(
	renderer: CliRenderer,
	opts: {
		zIndex: number;
		bg?: string;
	},
): { root: BoxRenderable; inner: BoxRenderable } {
	const root = new BoxRenderable(renderer, {
		position: "absolute",
		alignItems: "center",
		alignSelf: "center",
		justifyContent: "center",
		height: "100%",
		width: "100%",
		zIndex: opts.zIndex,
		visible: false,
	});

	const inner = new BoxRenderable(renderer, {
		backgroundColor: opts.bg,
		border: true,
		borderColor: theme.mauve,
		flexDirection: "column",
	});

	root.add(inner);

	return { root, inner };
}

export function createLayout(renderer: CliRenderer): TuiRefs {
	const syntaxStyle = createSyntaxStyle();
  renderer.root.flexDirection = "column";

	const scrollBox = new ScrollBoxRenderable(renderer, {
		flexGrow: 1,
		scrollY: true,
		stickyScroll: true,
	});
	renderer.root.add(scrollBox);

	const metaText = new TextRenderable(renderer, {
		content: `${env.model}`,
    fg: theme.muted,
    marginLeft: 1,
    marginTop: 1
	});
	renderer.root.add(metaText);

	const commandMenu = new BoxRenderable(renderer, {
		visible: false,
		borderColor: theme.mauve,
	});
	renderer.root.add(commandMenu);

	const commandMenuText = new TextRenderable(renderer, {
		content: "",
		fg: theme.text,
	});
	commandMenu.add(commandMenuText);

  const inputBox = new BoxRenderable(renderer, {
    borderColor: theme.border,
    paddingX: 1,
    height: 6
	});
	renderer.root.add(inputBox);

	const input = new TextareaRenderable(renderer, {
		textColor: theme.text,
		focusedTextColor: theme.text,
		placeholderColor: theme.muted,
    cursorColor: theme.mauve,
		keyBindings: [
			{ name: "return", action: "submit" },
			{ name: "return", shift: true, action: "newline" },
		],
	});
	input.selectionBg = theme.border;
	input.selectionFg = theme.text;
	inputBox.add(input);

	const statusRow = new BoxRenderable(renderer, {
		height: 1,
		flexDirection: "row",
		alignItems: "center",
	});
	renderer.root.add(statusRow);

	const statusText = new TextRenderable(renderer, {
		content: "",
		fg: theme.muted,
	});
	statusRow.add(statusText);
	statusRow.add(new BoxRenderable(renderer, { flexGrow: 1 }));

	const tokenText = new TextRenderable(renderer, {
		content: "",
		fg: theme.muted,
	});
	statusRow.add(tokenText);

	const { root: reasoningDialog, inner: reasoningInner } = createOverlayDialog(renderer, {
		zIndex: 10,
	});
	renderer.root.add(reasoningDialog);

	const reasoningTitle = new TextRenderable(renderer, {
		content: "Reasoning Effort",
		height: 1,
		fg: theme.mauve,
	});
	reasoningInner.add(reasoningTitle);

	const reasoningOptions = new TextRenderable(renderer, {
		content: "",
		fg: theme.text,
	});
	reasoningInner.add(reasoningOptions);

	const { root: hotkeysDialog, inner: hotkeysInner } = createOverlayDialog(renderer, {
		zIndex: 11,
	});
	renderer.root.add(hotkeysDialog);

	const hotkeysTitle = new TextRenderable(renderer, {
		content: "Hotkeys",
		height: 1,
		fg: theme.mauve,
	});
	hotkeysInner.add(hotkeysTitle);

	const hotkeysContent = new TextRenderable(renderer, {
		content: buildHotkeysText(),
		fg: theme.text,
	});
	hotkeysInner.add(hotkeysContent);

	void new MarkdownRenderable(renderer, {
		content: "",
		syntaxStyle,
		visible: false,
	});

	inputBox.onMouseDown = (e) => {
		e.preventDefault();
		input.focus();
	};
	scrollBox.onMouseDown = (e) => {
		e.preventDefault();
		input.focus();
	};
	metaText.onMouseDown = (e) => {
		e.preventDefault();
		input.focus();
	};
	statusRow.onMouseDown = (e) => {
		e.preventDefault();
		input.focus();
	};

	return {
		renderer,
		scrollBox,
		metaText,
		commandMenu,
		commandMenuText,
		input,
		inputBox,
		statusText,
		tokenText,
		reasoningDialog,
		reasoningOptions,
		hotkeysDialog,
	};
}

export function createMarkdownMessage(renderer: CliRenderer): MarkdownRenderable {
	return new MarkdownRenderable(renderer, {
		content: "",
		syntaxStyle: createSyntaxStyle(),
		fg: theme.text,
		conceal: true,
		concealCode: false,
		streaming: true,
		tableOptions: {
			widthMode: "full",
			wrapMode: "word",
      selectable: true,
		},
	});
}
