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
		top: `${number}%`;
		left: `${number}%`;
		width: `${number}%`;
		height: `${number}%`;
		zIndex: number;
	},
): BoxRenderable {
	return new BoxRenderable(renderer, {
		position: "absolute",
		top: opts.top,
		left: opts.left,
		width: opts.width,
		height: opts.height,
		zIndex: opts.zIndex,
		visible: false,
		border: true,
		borderStyle: "rounded",
		borderColor: theme.border,
		backgroundColor: theme.surface,
		flexDirection: "column",
		paddingX: 1,
		paddingY: 1,
	});
}

export function createLayout(renderer: CliRenderer): TuiRefs {
	const syntaxStyle = createSyntaxStyle();
	renderer.root.flexDirection = "column";

	const scrollBox = new ScrollBoxRenderable(renderer, {
		flexGrow: 1,
		scrollY: true,
		stickyScroll: true,
		paddingX: 2,
		paddingY: 1,
	});
	renderer.root.add(scrollBox);

	const metaText = new TextRenderable(renderer, {
		content: `  ${env.model}`,
		height: 1,
		paddingX: 2,
		fg: theme.muted,
	});
	renderer.root.add(metaText);

	const commandMenu = new BoxRenderable(renderer, {
		visible: false,
		border: true,
		borderStyle: "rounded",
		borderColor: theme.border,
		paddingX: 1,
		paddingY: 1,
		marginX: 2,
		marginBottom: 1,
		backgroundColor: theme.surface,
	});
	renderer.root.add(commandMenu);

	const commandMenuText = new TextRenderable(renderer, {
		content: "",
		fg: theme.text,
	});
	commandMenu.add(commandMenuText);

	const inputBox = new BoxRenderable(renderer, {
		height: 8,
		border: true,
		borderStyle: "rounded",
		borderColor: theme.border,
		paddingX: 1,
	});
	renderer.root.add(inputBox);

	const input = new TextareaRenderable(renderer, {
		flexGrow: 1,
		placeholder: "Type a message. Enter sends, Shift+Enter adds a newline…",
		wrapMode: "word",
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
		paddingX: 2,
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

	const reasoningDialog = createOverlayDialog(renderer, {
		top: "10%",
		left: "10%",
		width: "80%",
		height: "70%",
		zIndex: 10,
	});
	renderer.root.add(reasoningDialog);

	const reasoningTitle = new TextRenderable(renderer, {
		content: "Reasoning Effort  ·  Enter select  ·  Esc close",
		height: 1,
		fg: theme.mauve,
		marginBottom: 1,
	});
	reasoningDialog.add(reasoningTitle);

	const reasoningOptions = new TextRenderable(renderer, {
		content: "",
		fg: theme.text,
	});
	reasoningDialog.add(reasoningOptions);

	const hotkeysDialog = createOverlayDialog(renderer, {
		top: "15%",
		left: "15%",
		width: "70%",
		height: "60%",
		zIndex: 11,
	});
	renderer.root.add(hotkeysDialog);

	const hotkeysTitle = new TextRenderable(renderer, {
		content: "Hotkeys  ·  Esc close",
		height: 1,
		fg: theme.mauve,
		marginBottom: 1,
	});
	hotkeysDialog.add(hotkeysTitle);

	const hotkeysContent = new TextRenderable(renderer, {
		content: buildHotkeysText(),
		fg: theme.text,
	});
	hotkeysDialog.add(hotkeysContent);

	// Keep the renderer's markdown renderer initialized with the shared syntax style.
	void new MarkdownRenderable(renderer, {
		content: "",
		syntaxStyle,
		visible: false,
	});

	inputBox.onMouseDown = () => input.focus();
	scrollBox.onMouseDown = () => input.focus();
	metaText.onMouseDown = () => input.focus();
	statusRow.onMouseDown = () => input.focus();

	return {
		renderer,
		scrollBox,
		metaText,
		commandMenu,
		commandMenuText,
		input,
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
			borders: true,
			outerBorder: true,
			borderStyle: "rounded",
			borderColor: theme.border,
			selectable: true,
		},
	});
}
