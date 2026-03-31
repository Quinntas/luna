import { spawn } from "node:child_process";
import type { LunaRuntime } from "../../index.ts";
import { SIDEBAR_CONFIG } from "../config/index.ts";
import type { SidebarThread, TuiRefs, TuiState } from "../types.ts";

function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins}m`;
	if (diffHours < 24) return `${diffHours}h`;
	if (diffDays === 1) return "1d";
	if (diffDays < 7) return `${diffDays}d`;
	return date.toLocaleDateString();
}

function execGit(
	cmd: string,
	args: string[],
	cwd: string,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
	return new Promise((resolve) => {
		const child = spawn(cmd, args, {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (data) => {
			stdout += data.toString();
		});
		child.stderr.on("data", (data) => {
			stderr += data.toString();
		});
		child.on("error", (err) => {
			resolve({ stdout, stderr: err.message, code: -1 });
		});
		child.on("close", (code) => {
			resolve({ stdout, stderr, code });
		});
	});
}

async function getGitStatus(repoRoot: string): Promise<"clean" | "dirty"> {
	const result = await execGit("git", ["status", "--porcelain"], repoRoot);
	if (result.stdout.trim().length > 0) {
		return "dirty";
	}
	return "clean";
}

export async function loadSidebarThreads(runtime: LunaRuntime): Promise<SidebarThread[]> {
	const threads = await runtime.listThreads();
	return [...threads]
		.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
		.slice(0, SIDEBAR_CONFIG.maxThreadsPerProject)
		.map((t) => ({
			id: t.id,
			title: t.title,
			branch: t.workspace.branch,
			mode: t.workspace.mode,
			repoRoot: t.repoRoot,
			createdAt: t.createdAt,
			updatedAt: t.updatedAt,
		}));
}

export async function loadThreadStatuses(threads: SidebarThread[]): Promise<void> {
	for (const thread of threads) {
		try {
			thread.status = await getGitStatus(thread.repoRoot);
		} catch {
			thread.status = "clean";
		}
	}
}

export function buildSidebarOptions(
	threads: SidebarThread[],
	currentThreadId: string | null,
): { name: string; description: string; value: string }[] {
	return threads.map((thread) => {
		const isActive = thread.id === currentThreadId;
		const statusIcon = thread.status === "dirty" ? "●" : "○";
		const branchLabel = thread.branch ?? "main";
		return {
			name: `${isActive ? "▶ " : "  "}${thread.title || thread.id.slice(0, 8)}`,
			description: `${statusIcon} ${branchLabel} · ${formatDate(thread.updatedAt)}`,
			value: thread.id,
		};
	});
}

export function updateSidebar(state: TuiState, refs: TuiRefs): void {
	if (!state.sidebarVisible) {
		refs.sidebar.visible = false;
		refs.sidebarContainer.width = 0;
		return;
	}

	refs.sidebar.visible = true;
	refs.sidebarContainer.width = SIDEBAR_CONFIG.widthChars;
	refs.sidebar.options = buildSidebarOptions(state.sidebarThreads, state.currentThreadId);

	const idx = Math.max(0, Math.min(state.selectedThreadIdx, state.sidebarThreads.length - 1));
	refs.sidebar.setSelectedIndex(idx);
}

export async function toggleSidebar(
	state: TuiState,
	refs: TuiRefs,
	runtime: LunaRuntime,
): Promise<void> {
	state.sidebarVisible = !state.sidebarVisible;

	if (state.sidebarVisible) {
		refs.statusText.content = "Loading threads...";
		state.sidebarThreads = await loadSidebarThreads(runtime);
		// select the currently active thread if it's in the list
		const activeIdx = state.sidebarThreads.findIndex((t) => t.id === state.currentThreadId);
		state.selectedThreadIdx = activeIdx >= 0 ? activeIdx : 0;
		refs.statusText.content = "";

		// load git statuses in the background
		void loadThreadStatuses(state.sidebarThreads).then(() => updateSidebar(state, refs));
	}

	updateSidebar(state, refs);

	if (!state.sidebarVisible) {
		refs.input.focus();
	}
}

export function handleSidebarNavigation(
	state: TuiState,
	refs: TuiRefs,
	eventName: string,
): boolean {
	if (!state.sidebarVisible) return false;

	const threads = state.sidebarThreads;
	if (threads.length === 0) return false;

	if (eventName === "down" || eventName === "j") {
		state.selectedThreadIdx = Math.min(threads.length - 1, state.selectedThreadIdx + 1);
		updateSidebar(state, refs);
		return true;
	}
	if (eventName === "up" || eventName === "k") {
		state.selectedThreadIdx = Math.max(0, state.selectedThreadIdx - 1);
		updateSidebar(state, refs);
		return true;
	}

	return false;
}

export function getSelectedThreadId(state: TuiState): string | null {
	const thread = state.sidebarThreads[state.selectedThreadIdx];
	return thread?.id ?? null;
}
