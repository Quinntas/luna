import { spawn } from "node:child_process";
import type { LunaRuntime } from "../../index.ts";
import { SIDEBAR_CONFIG } from "../config/index.ts";
import type { SidebarProject, SidebarThread, TuiRefs, TuiState } from "../types.ts";

function getRepoName(repoRoot: string): string {
	const parts = repoRoot.split("/");
	return parts.at(-1) ?? repoRoot;
}

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

async function getCurrentBranch(repoRoot: string): Promise<string> {
	const result = await execGit("git", ["branch", "--show-current"], repoRoot);
	return result.stdout.trim() || "main";
}

export async function loadSidebarThreads(runtime: LunaRuntime): Promise<SidebarProject[]> {
	const threads = await runtime.listThreads();
	const groups = new Map<string, SidebarThread[]>();

	for (const t of threads) {
		const repoName = getRepoName(t.repoRoot);
		const existing = groups.get(repoName) ?? [];
		existing.push({
			id: t.id,
			title: t.title,
			branch: t.workspace.branch,
			mode: t.workspace.mode,
			repoRoot: t.repoRoot,
			createdAt: t.createdAt,
			updatedAt: t.updatedAt,
		});
		groups.set(repoName, existing);
	}

	const projects: SidebarProject[] = [];
	for (const [name, threads] of groups) {
		const sortedThreads = threads
			.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
			.slice(0, SIDEBAR_CONFIG.maxThreadsPerProject);

		const repoRoot = sortedThreads[0]?.repoRoot ?? "";
		const currentBranch = repoRoot ? await getCurrentBranch(repoRoot) : "main";

		projects.push({
			name,
			threads: sortedThreads,
			expanded: false,
			currentBranch,
		});
	}

	return projects.sort((a, b) => {
		const aTime = a.threads[0]?.updatedAt ?? "";
		const bTime = b.threads[0]?.updatedAt ?? "";
		return new Date(bTime).getTime() - new Date(aTime).getTime();
	});
}

export async function loadProjectStatus(project: SidebarProject): Promise<void> {
	for (const thread of project.threads) {
		try {
			thread.status = await getGitStatus(thread.repoRoot);
		} catch {
			thread.status = "clean";
		}
	}
}

export function buildSidebarOptions(
	projects: SidebarProject[],
): { name: string; description: string; value: string }[] {
	const options: { name: string; description: string; value: string }[] = [];

	for (let pIdx = 0; pIdx < projects.length; pIdx++) {
		const project = projects[pIdx];
		if (!project) continue;
		const expandIcon = project.expanded ? "▼" : "▶";
		const branchName = project.currentBranch;
		options.push({
			name: `${project.name}/ (${project.threads.length})`,
			description: `${expandIcon} ${branchName}`,
			value: `project:${pIdx}`,
		});

		if (project.expanded) {
			for (let tIdx = 0; tIdx < project.threads.length; tIdx++) {
				const thread = project.threads[tIdx];
				if (!thread) continue;
				const prefix = tIdx === project.threads.length - 1 ? "└─" : "├─";
				const statusIcon = thread.status === "dirty" ? "●" : "○";
				options.push({
					name: ` ${prefix} ${thread.title || thread.id.slice(0, 8)}`,
					description: `${statusIcon} ${formatDate(thread.updatedAt)}`,
					value: `thread:${pIdx}:${tIdx}`,
				});
			}
		}
	}

	return options;
}

export function updateSidebar(state: TuiState, refs: TuiRefs): void {
	if (!state.sidebarVisible) {
		refs.sidebar.visible = false;
		refs.sidebarContainer.width = 0;
		return;
	}

	refs.sidebar.visible = true;
	refs.sidebarContainer.width = SIDEBAR_CONFIG.widthChars;
	refs.sidebar.options = buildSidebarOptions(state.sidebarProjects);

	const optionIdx = getSelectedOptionIndex(state);
	if (optionIdx >= 0) {
		refs.sidebar.setSelectedIndex(optionIdx);
	}
}

function getSelectedOptionIndex(state: TuiState): number {
	let idx = 0;
	for (let pIdx = 0; pIdx < state.sidebarProjects.length; pIdx++) {
		if (pIdx === state.selectedProjectIdx) {
			if (state.sidebarMode === "projects") {
				return idx;
			}
			idx++;
			const project = state.sidebarProjects[pIdx];
			if (!project) return idx;
			for (let tIdx = 0; tIdx < project.threads.length; tIdx++) {
				if (tIdx === state.selectedThreadIdx) {
					return idx;
				}
				idx++;
			}
		} else {
			idx++;
			const proj = state.sidebarProjects[pIdx];
			if (proj?.expanded) {
				idx += proj.threads.length;
			}
		}
	}
	return 0;
}

export async function toggleSidebar(
	state: TuiState,
	refs: TuiRefs,
	runtime: LunaRuntime,
): Promise<void> {
	state.sidebarVisible = !state.sidebarVisible;

	if (state.sidebarVisible && state.sidebarProjects.length === 0) {
		refs.statusText.content = "Loading threads...";
		state.sidebarProjects = await loadSidebarThreads(runtime);
		state.selectedProjectIdx = 0;
		state.selectedThreadIdx = 0;
		state.sidebarMode = "projects";
		refs.statusText.content = "";
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
	shiftKey: boolean,
): boolean {
	if (!state.sidebarVisible) return false;

	const projects = state.sidebarProjects;
	if (projects.length === 0) return false;

	if (shiftKey) {
		if (eventName === "up" || eventName === "k") {
			state.selectedProjectIdx = Math.max(0, state.selectedProjectIdx - 1);
			state.sidebarMode = "projects";
			updateSidebar(state, refs);
			return true;
		}
		if (eventName === "down" || eventName === "j") {
			state.selectedProjectIdx = Math.min(projects.length - 1, state.selectedProjectIdx + 1);
			state.sidebarMode = "projects";
			updateSidebar(state, refs);
			return true;
		}
	}

	const currentProject = projects[state.selectedProjectIdx];
	if (!currentProject) return false;

	if (state.sidebarMode === "projects") {
		if (eventName === "down" || eventName === "j") {
			if (currentProject.expanded && currentProject.threads.length > 0) {
				state.sidebarMode = "threads";
				state.selectedThreadIdx = 0;
			} else {
				state.selectedProjectIdx = Math.min(projects.length - 1, state.selectedProjectIdx + 1);
			}
			updateSidebar(state, refs);
			return true;
		}
		if (eventName === "up" || eventName === "k") {
			if (state.selectedProjectIdx > 0) {
				state.selectedProjectIdx--;
				const prevProject = projects[state.selectedProjectIdx];
				if (prevProject?.expanded && prevProject.threads.length > 0) {
					state.sidebarMode = "threads";
					state.selectedThreadIdx = prevProject.threads.length - 1;
				} else {
					state.sidebarMode = "projects";
				}
			}
			updateSidebar(state, refs);
			return true;
		}
		if (eventName === "right" || eventName === "enter") {
			if (!currentProject.expanded) {
				currentProject.expanded = true;
				void loadProjectStatus(currentProject);
				updateSidebar(state, refs);
			}
			return true;
		}
		if (eventName === "left") {
			if (currentProject.expanded) {
				currentProject.expanded = false;
				state.sidebarMode = "projects";
				updateSidebar(state, refs);
			}
			return true;
		}
	} else {
		if (eventName === "down" || eventName === "j") {
			if (state.selectedThreadIdx < currentProject.threads.length - 1) {
				state.selectedThreadIdx++;
			} else {
				state.sidebarMode = "projects";
			}
			updateSidebar(state, refs);
			return true;
		}
		if (eventName === "up" || eventName === "k") {
			if (state.selectedThreadIdx > 0) {
				state.selectedThreadIdx--;
			} else {
				state.sidebarMode = "projects";
			}
			updateSidebar(state, refs);
			return true;
		}
		if (eventName === "left" || eventName === "enter") {
			currentProject.expanded = false;
			state.sidebarMode = "projects";
			updateSidebar(state, refs);
			return true;
		}
	}

	return false;
}

export function getSelectedThreadId(state: TuiState): string | null {
	const project = state.sidebarProjects[state.selectedProjectIdx];
	if (!project || state.sidebarMode !== "threads") return null;
	const thread = project.threads[state.selectedThreadIdx];
	return thread?.id ?? null;
}
