import type {
	BoxRenderable,
	createCliRenderer,
	MarkdownRenderable,
	ScrollBoxRenderable,
	SelectRenderable,
	TextareaRenderable,
	TextRenderable,
} from "@opentui/core";
import type { ThreadTokenUsageSnapshot } from "../codex/typesCore";

export type CliRenderer = Awaited<ReturnType<typeof createCliRenderer>>;

export type ActiveDialog = "reasoning" | "hotkeys" | null;

export interface SlashCommand {
	readonly name: string;
	readonly description: string;
	readonly action: "hotkeys" | "reasoning" | "mode" | "clear";
}

export interface TuiRefs {
	readonly renderer: CliRenderer;
	readonly scrollBox: ScrollBoxRenderable;
	readonly metaText: TextRenderable;
	readonly commandMenu: SelectRenderable;
	readonly commandMenuText: TextRenderable | null;
	readonly input: TextareaRenderable;
	readonly inputBox: BoxRenderable;
	readonly statusText: TextRenderable;
	readonly tokenText: TextRenderable;
	readonly reasoningDialog: BoxRenderable;
	readonly reasoningOptions: TextRenderable;
	readonly hotkeysDialog: BoxRenderable;
}

export interface HistoryEntry {
	role: "user" | "assistant";
	content: string;
}

export function createInitialState(): TuiState {
	return {
		inputEnabled: false,
		currentResponse: null,
		spinnerTimer: undefined,
		spinnerIdx: 0,
		lastTurnDurationMs: null,
		activeTurnStartedAtMs: null,
		latestTokenUsage: null,
		activeDialog: null,
		reasoningEffort: "low",
		reasoningEffortIdx: 0,
		commandMatches: [],
		commandSelectionIdx: 0,
		worktreeMode: false,
		history: [],
		historyIndex: -1,
	};
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
	worktreeMode: boolean;
	history: HistoryEntry[];
	historyIndex: number;
}
