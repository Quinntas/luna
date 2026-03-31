import {
	BoxRenderable,
	MarkdownRenderable,
	ScrollBoxRenderable,
	SelectRenderable,
	TextareaRenderable,
	TextRenderable,
} from "@opentui/core";
import { createSyntaxStyle, env, theme } from "../config/index.ts";
import { buildHotkeysText } from "../input/commands.ts";
import type { CliRenderer, TuiRefs } from "../types.ts";

export function createLayout(renderer: CliRenderer): TuiRefs {
	const syntaxStyle = createSyntaxStyle();

	// Main Layout Container (row direction)
	const layoutContainer = new BoxRenderable(renderer, {
		flexDirection: "row",
		flexGrow: 1,
	});
	renderer.root.add(layoutContainer);

	// =====================
	// Sidebar Components
	// =====================
	const sidebarContainer = new BoxRenderable(renderer, {
		width: 0, // Hidden by default
		height: "100%",
	});
	layoutContainer.add(sidebarContainer);

	const sidebar = new SelectRenderable(renderer, {
		visible: false,
		width: "100%",
		height: "100%",
		options: [],
		wrapSelection: true,
		showDescription: true,
		textColor: theme.text,
		selectedTextColor: theme.text,
		selectedBackgroundColor: theme.mauve,
		descriptionColor: theme.subtext,
	});
	sidebarContainer.add(sidebar);

	// =====================
	// Chat Components
	// =====================
	const chatContainer = new BoxRenderable(renderer, {
		flexDirection: "column",
		flexGrow: 1,
	});
	layoutContainer.add(chatContainer);

	// Chat Messages (ScrollBox)
	const scrollBox = new ScrollBoxRenderable(renderer, {
		flexGrow: 1,
		scrollY: true,
		stickyScroll: true,
	});
	chatContainer.add(scrollBox);

	// Meta Text (model indicator)
	const metaText = new TextRenderable(renderer, {
		content: `${env.model}`,
		fg: theme.muted,
		marginLeft: 1,
		marginTop: 1,
	});
	chatContainer.add(metaText);

	// Command Menu (slash commands dropdown)
	const commandMenu = new SelectRenderable(renderer, {
		visible: false,
		width: 50,
		height: 8,
		options: [],
		wrapSelection: true,
		showDescription: true,
		textColor: theme.text,
		selectedTextColor: theme.text,
		selectedBackgroundColor: theme.mauve,
		descriptionColor: theme.subtext,
	});
	chatContainer.add(commandMenu);

	const commandMenuText = null;

	// Input Box
	const inputBox = new BoxRenderable(renderer, {
		borderColor: theme.border,
		paddingX: 1,
		height: 6,
	});
	chatContainer.add(inputBox);

	// Input Textarea
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

	// Status Row
	const statusRow = new BoxRenderable(renderer, {
		height: 1,
		flexDirection: "row",
		alignItems: "center",
		marginLeft: 1,
	});
	chatContainer.add(statusRow);

	// Status Text
	const statusText = new TextRenderable(renderer, {
		content: "",
		fg: theme.muted,
	});
	statusRow.add(statusText);

	// Spacer
	statusRow.add(new BoxRenderable(renderer, { flexGrow: 1 }));

	// Token Text
	const tokenText = new TextRenderable(renderer, {
		content: "",
		fg: theme.muted,
	});
	statusRow.add(tokenText);

	// Hotkey Hint
	const hotkeyHint = new TextRenderable(renderer, {
		content: "ctrl+b threads | ctrl+h hotkeys",
		fg: theme.muted,
		marginLeft: 1,
		marginRight: 1,
	});
	statusRow.add(hotkeyHint);

	// =====================
	// Dialog Components (overlays)
	// =====================
	const reasoningDialog = new BoxRenderable(renderer, {
		position: "absolute",
		alignItems: "center",
		alignSelf: "center",
		justifyContent: "center",
		height: "100%",
		width: "100%",
		zIndex: 10,
		visible: false,
	});
	renderer.root.add(reasoningDialog);

	const reasoningInner = new BoxRenderable(renderer, {
		border: true,
		borderColor: theme.mauve,
		flexDirection: "column",
	});
	reasoningDialog.add(reasoningInner);

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

	const hotkeysDialog = new BoxRenderable(renderer, {
		position: "absolute",
		alignItems: "center",
		alignSelf: "center",
		justifyContent: "center",
		height: "100%",
		width: "100%",
		zIndex: 11,
		visible: false,
	});
	renderer.root.add(hotkeysDialog);

	const hotkeysInner = new BoxRenderable(renderer, {
		border: true,
		borderColor: theme.mauve,
		flexDirection: "column",
	});
	hotkeysDialog.add(hotkeysInner);

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

	// Hidden MarkdownRenderable (for message rendering)
	void new MarkdownRenderable(renderer, {
		content: "",
		syntaxStyle,
		visible: false,
	});

	// =====================
	// Event Handlers
	// =====================
	inputBox.onMouseDown = (e) => {
		e.preventDefault();
		input.focus();
	};
	scrollBox.onMouseDown = () => {
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
		hotkeyHint,
		sidebar,
		sidebarContainer,
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
