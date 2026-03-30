import type {
	BoxRenderable,
	createCliRenderer,
	MarkdownRenderable,
	ScrollBoxRenderable,
	TextareaRenderable,
	TextRenderable,
} from "@opentui/core";
import type { ThreadTokenUsageSnapshot } from "../codex/typesCore";

export type CliRenderer = Awaited<ReturnType<typeof createCliRenderer>>;

export type ActiveDialog = "reasoning" | "hotkeys" | null;

export interface SlashCommand {
	readonly name: string;
	readonly description: string;
	readonly action: "hotkeys" | "reasoning" | "clear";
}

export interface TuiRefs {
	readonly renderer: CliRenderer;
	readonly scrollBox: ScrollBoxRenderable;
	readonly metaText: TextRenderable;
	readonly commandMenu: BoxRenderable;
	readonly commandMenuText: TextRenderable;
	readonly input: TextareaRenderable;
	readonly statusText: TextRenderable;
	readonly tokenText: TextRenderable;
	readonly reasoningDialog: BoxRenderable;
	readonly reasoningOptions: TextRenderable;
	readonly hotkeysDialog: BoxRenderable;
}

export interface TuiState {
	inputEnabled: boolean;
	currentResponse: MarkdownRenderable | null;
	spinnerTimer: ReturnType<typeof setInterval> | undefined;
	spinnerIdx: number;
	lastTurnDurationMs: number | null;
	activeTurnStartedAtMs: number | null;
	latestTokenUsage: ThreadTokenUsageSnapshot | null;
	activeDialog: ActiveDialog;
	reasoningEffort: "low" | "medium" | "high";
	reasoningEffortIdx: number;
	commandMatches: ReadonlyArray<SlashCommand>;
	commandSelectionIdx: number;
}
