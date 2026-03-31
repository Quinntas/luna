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
	readonly action: "hotkeys" | "reasoning" | "mode" | "clear" | "pr";
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
	readonly hotkeyHint: TextRenderable;
	readonly sidebar: SelectRenderable;
	readonly sidebarContainer: BoxRenderable;
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
		worktreeMode: true,
		history: [],
		historyIndex: -1,
		threadTitle: "New thread",
		sidebarVisible: false,
		sidebarProjects: [],
		selectedProjectIdx: 0,
		selectedThreadIdx: 0,
		sidebarMode: "projects", // "projects" | "threads"
	};
}

export interface SidebarThread {
	id: string;
	title: string;
	branch: string | null;
	mode: "repo-root" | "worktree";
	repoRoot: string;
	createdAt: string;
	updatedAt: string;
	status?: "clean" | "dirty";
}

export interface SidebarProject {
	name: string;
	threads: SidebarThread[];
	expanded: boolean;
	currentBranch: string;
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
	threadTitle: string;
	sidebarVisible: boolean;
	sidebarProjects: SidebarProject[];
	selectedProjectIdx: number;
	selectedThreadIdx: number;
	sidebarMode: "projects" | "threads";
}
