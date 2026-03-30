import { RGBA, SyntaxStyle } from "@opentui/core";

export const env = {
	model: process.env.CODEX_MODEL ?? "gpt-5.4",
	binaryPath: process.env.CODEX_BINARY_PATH,
	homePath: process.env.CODEX_HOME,
	dbPath: process.env.LUNA_DB_PATH,
	repoRoot: process.env.LUNA_REPO_ROOT ?? process.cwd(),
};

export const theme = {
	text: "#cdd6f4",
	subtext: "#a6adc8",
	muted: "#585b70",
	surface: "#1e1e2e",
	border: "#45475a",
	mauve: "#cba6f7",
	sky: "#89dceb",
	red: "#f38ba8",
	yellow: "#f9e2af",
	green: "#a6e3a1",
};

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
export const SCROLL_STEP = 3;
export const textDecoder = new TextDecoder();
export const REASONING_EFFORTS = ["low", "medium", "high"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export function createSyntaxStyle(): SyntaxStyle {
	return SyntaxStyle.fromStyles({
		default: { fg: RGBA.fromHex("#cdd6f4") },
		comment: { fg: RGBA.fromHex("#6c7086"), italic: true },
		number: { fg: RGBA.fromHex("#fab387") },
		boolean: { fg: RGBA.fromHex("#fab387") },
		constant: { fg: RGBA.fromHex("#fab387") },
		string: { fg: RGBA.fromHex("#a6e3a1") },
		character: { fg: RGBA.fromHex("#a6e3a1") },
		keyword: { fg: RGBA.fromHex("#cba6f7"), bold: true },
		operator: { fg: RGBA.fromHex("#89dceb") },
		function: { fg: RGBA.fromHex("#89b4fa") },
		"function.call": { fg: RGBA.fromHex("#89b4fa") },
		"function.method.call": { fg: RGBA.fromHex("#89b4fa") },
		type: { fg: RGBA.fromHex("#f9e2af") },
		constructor: { fg: RGBA.fromHex("#f9e2af") },
		property: { fg: RGBA.fromHex("#94e2d5") },
		"variable.member": { fg: RGBA.fromHex("#94e2d5") },
		punctuation: { fg: RGBA.fromHex("#bac2de") },
		"punctuation.bracket": { fg: RGBA.fromHex("#bac2de") },
		"punctuation.delimiter": { fg: RGBA.fromHex("#a6adc8") },
		"markup.heading": { fg: RGBA.fromHex("#89b4fa"), bold: true },
		"markup.heading.1": { fg: RGBA.fromHex("#89b4fa"), bold: true },
		"markup.heading.2": { fg: RGBA.fromHex("#74c7ec"), bold: true },
		"markup.heading.3": { fg: RGBA.fromHex("#94e2d5"), bold: true },
		"markup.list": { fg: RGBA.fromHex("#f38ba8") },
		"markup.quote": { fg: RGBA.fromHex("#6c7086"), italic: true },
		"markup.bold": { fg: RGBA.fromHex("#f5e0dc"), bold: true },
		"markup.strong": { fg: RGBA.fromHex("#f5e0dc"), bold: true },
		"markup.italic": { fg: RGBA.fromHex("#f5e0dc"), italic: true },
		"markup.link": { fg: RGBA.fromHex("#89b4fa"), underline: true },
		"markup.link.url": { fg: RGBA.fromHex("#89b4fa"), underline: true },
		"markup.raw": { fg: RGBA.fromHex("#a6e3a1") },
		"markup.raw.block": { fg: RGBA.fromHex("#a6e3a1") },
	});
}
