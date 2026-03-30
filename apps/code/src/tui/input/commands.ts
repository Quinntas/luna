import { buildHotkeysText } from "../config/hotkeys.ts";
import type { SlashCommand } from "../types.ts";

export const SLASH_COMMANDS: ReadonlyArray<SlashCommand> = [
	{ name: "/hotkeys", description: "Open the hotkeys dialog", action: "hotkeys" },
	{ name: "/reasoning", description: "Open the reasoning effort dialog", action: "reasoning" },
	{ name: "/mode", description: "Toggle worktree/repo-root mode", action: "mode" },
	{ name: "/clear", description: "Clear the chat history", action: "clear" },
];

export { buildHotkeysText };
