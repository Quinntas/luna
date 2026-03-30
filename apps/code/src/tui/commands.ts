import type { SlashCommand } from "./types.ts";

export const SLASH_COMMANDS: ReadonlyArray<SlashCommand> = [
	{ name: "/hotkeys", description: "Open the hotkeys dialog", action: "hotkeys" },
	{ name: "/reasoning", description: "Open the reasoning effort dialog", action: "reasoning" },
	{ name: "/clear", description: "Clear the chat history", action: "clear" },
];

const HOTKEY_GROUPS = [
	{
		title: "Chat",
		entries: [
			["Enter", "Send message"],
			["Shift+Enter", "Insert newline"],
			["PgUp/PgDn", "Scroll chat"],
		],
	},
	{
		title: "Dialogs",
		entries: [
			["Ctrl+R", "Open reasoning effort dialog"],
			["Ctrl+/", "Open hotkeys dialog"],
			["/hotkeys", "Open hotkeys dialog"],
			["Esc", "Close active dialog or menu"],
		],
	},
	{
		title: "Commands",
		entries: [
			["/hotkeys", "Show hotkeys dialog"],
			["/reasoning", "Show reasoning dialog"],
			["/clear", "Clear chat history"],
		],
	},
	{
		title: "Clipboard",
		entries: [
			["Alt+C", "Copy selected text"],
			["Ctrl+Shift+C", "Copy selected text"],
		],
	},
	{
		title: "App",
		entries: [["Ctrl+C", "Quit"]],
	},
] as const;

export function buildHotkeysText(): string {
	return HOTKEY_GROUPS.map((group) => {
		const entries = group.entries
			.map(([key, description]) => `${key.padEnd(14, " ")} ${description}`)
			.join("\n");
		return `${group.title}\n${entries}`;
	}).join("\n\n");
}
