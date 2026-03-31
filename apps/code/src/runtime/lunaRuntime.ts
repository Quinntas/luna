import { CodexSessionAdapter } from "../codex/codexSessionAdapter";
import type { LunaRuntimeEvent } from "../contracts/events";
import type { LunaLogger, ThreadStore } from "../contracts/ports";
import type {
	LunaGenerateInput,
	LunaSendMessageInput,
	LunaStartThreadInput,
} from "../contracts/session";
import type { LunaThreadRecord } from "../contracts/thread";
import { MemoryThreadStore } from "../storage/memoryThreadStore";
import { checkpointRefForThreadTurn } from "../worktree/checkpointRefs";
import { WorktreeCheckpointStore } from "../worktree/checkpointStore";
import { WorktreeManager } from "../worktree/worktreeManager";
import { LunaEventBus } from "./eventBus";
import { ThreadController } from "./threadController";
import { appendCheckpointRef, removeCheckpointRefs } from "./threadState";

export interface LunaRuntimeOptions {
	readonly store?: ThreadStore;
	readonly logger?: LunaLogger;
	readonly codex?: {
		readonly adapter?: CodexSessionAdapter;
	};
	readonly worktree?: {
		readonly manager?: WorktreeManager;
		readonly worktreesDir?: string;
		readonly checkpoints?: WorktreeCheckpointStore;
	};
}

export class LunaRuntime {
	private readonly bus = new LunaEventBus();
	private readonly controller: ThreadController;
	private readonly unsubscribeCodex: () => void;
	private readonly store: ThreadStore;
	private readonly checkpoints: WorktreeCheckpointStore;
	private readonly worktreeManager: WorktreeManager;
	private readonly checkpointWork = new Map<string, Promise<void>>();
	private readonly activeTurnCounts = new Map<string, number>();
	private readonly idleWaiters = new Map<string, Set<() => void>>();

	private incrementActiveTurn(threadId: string): void {
		this.activeTurnCounts.set(threadId, (this.activeTurnCounts.get(threadId) ?? 0) + 1);
	}

	private decrementActiveTurn(threadId: string): void {
		const nextCount = Math.max(0, (this.activeTurnCounts.get(threadId) ?? 0) - 1);
		if (nextCount === 0) {
			this.activeTurnCounts.delete(threadId);
			this.flushIdleWaiters(threadId);
			return;
		}
		this.activeTurnCounts.set(threadId, nextCount);
	}

	private flushIdleWaiters(threadId: string): void {
		if ((this.activeTurnCounts.get(threadId) ?? 0) > 0) {
			return;
		}
		if (this.checkpointWork.has(threadId)) {
			return;
		}

		const waiters = this.idleWaiters.get(threadId);
		if (!waiters) {
			return;
		}

		this.idleWaiters.delete(threadId);
		for (const resolve of waiters) {
			resolve();
		}
	}

	private async awaitCheckpointWork(threadId: string): Promise<void> {
		await this.checkpointWork.get(threadId);
	}

	private async awaitThreadIdle(threadId: string): Promise<void> {
		await this.awaitCheckpointWork(threadId);
		if ((this.activeTurnCounts.get(threadId) ?? 0) === 0 && !this.checkpointWork.has(threadId)) {
			return;
		}

		await new Promise<void>((resolve) => {
			const waiters = this.idleWaiters.get(threadId) ?? new Set<() => void>();
			waiters.add(resolve);
			this.idleWaiters.set(threadId, waiters);
			this.flushIdleWaiters(threadId);
		});
	}

	constructor(options?: LunaRuntimeOptions) {
		const store = options?.store ?? new MemoryThreadStore();
		const codex = options?.codex?.adapter ?? new CodexSessionAdapter({ logger: options?.logger });
		const worktree =
			options?.worktree?.manager ??
			new WorktreeManager({ worktreesDir: options?.worktree?.worktreesDir });
		const checkpoints = options?.worktree?.checkpoints ?? new WorktreeCheckpointStore();

		this.store = store;
		this.checkpoints = checkpoints;
		this.worktreeManager = worktree;

		this.controller = new ThreadController({
			store,
			codex,
			worktree,
			events: this.bus,
			logger: options?.logger,
		});
		this.unsubscribeCodex = codex.onEvent((event) => {
			this.bus.emit({
				...event,
			} as Omit<LunaRuntimeEvent, "eventId" | "timestamp">);
			if (event.type === "turn.completed") {
				const previous = this.checkpointWork.get(event.threadId) ?? Promise.resolve();
				const next = previous
					.catch(() => {})
					.then(async () => {
						await this.captureCheckpointForThread(event.threadId);
					})
					.finally(() => {
						if (this.checkpointWork.get(event.threadId) === next) {
							this.checkpointWork.delete(event.threadId);
							this.flushIdleWaiters(event.threadId);
						}
					});
				this.checkpointWork.set(event.threadId, next);
				this.decrementActiveTurn(event.threadId);
			}
			if (
				event.type === "turn.aborted" ||
				event.type === "session.error" ||
				event.type === "session.exited"
			) {
				this.activeTurnCounts.delete(event.threadId);
				this.flushIdleWaiters(event.threadId);
			}
		});
	}

	private async captureCheckpointForThread(threadId: string): Promise<void> {
		const thread = await this.store.getThread(threadId);
		if (!thread || thread.workspace.mode !== "worktree") {
			return;
		}

		const sequence = thread.workspace.checkpointSequence + 1;
		const checkpointRef = checkpointRefForThreadTurn(threadId, sequence);

		try {
			await this.checkpoints.captureCheckpoint({
				cwd: thread.workspace.cwd,
				checkpointRef,
			});
			await this.store.putThread(appendCheckpointRef(thread, checkpointRef));
			this.bus.emit({
				threadId,
				source: "luna",
				type: "checkpoint.captured",
				payload: { checkpointRef, cwd: thread.workspace.cwd, sequence },
			});
		} catch (error) {
			this.bus.emit({
				threadId,
				source: "luna",
				type: "checkpoint.error",
				payload: {
					message: error instanceof Error ? error.message : String(error),
					cwd: thread.workspace.cwd,
					sequence,
				},
			});
		}
	}

	on(listener: (event: LunaRuntimeEvent) => void): () => void {
		return this.bus.on(listener);
	}

	startThread(input: LunaStartThreadInput): Promise<LunaThreadRecord> {
		return this.controller.startThread(input);
	}

	async resumeThread(threadId: string): Promise<LunaThreadRecord> {
		const thread = await this.store.getThread(threadId);
		if (!thread) {
			throw new Error(`Unknown thread: ${threadId}`);
		}

		return this.startThread({
			threadId: thread.id,
			title: thread.title,
			repoRoot: thread.repoRoot,
			worktree: {
				mode: thread.workspace.mode === "worktree" ? "reuse-or-create" : "repo-root",
				branch: thread.workspace.branch ?? undefined,
				path: thread.workspace.worktreePath,
			},
			codex: {
				model: thread.codex.model ?? undefined,
				runtimeMode: thread.codex.runtimeMode,
			},
		});
	}

	async restartThread(
		threadId: string,
		overrides?: Partial<Pick<LunaStartThreadInput, "title" | "repoRoot" | "worktree" | "codex">>,
	): Promise<LunaThreadRecord> {
		const thread = await this.store.getThread(threadId);
		if (!thread) {
			throw new Error(`Unknown thread: ${threadId}`);
		}

		try {
			await this.stopThread(threadId);
		} catch {
			// best effort restart
		}

		return this.startThread({
			threadId: thread.id,
			title: overrides?.title ?? thread.title,
			repoRoot: overrides?.repoRoot ?? thread.repoRoot,
			worktree: overrides?.worktree ?? {
				mode: thread.workspace.mode === "worktree" ? "reuse-or-create" : "repo-root",
				branch: thread.workspace.branch ?? undefined,
				path: thread.workspace.worktreePath,
			},
			codex: overrides?.codex ?? {
				model: thread.codex.model ?? undefined,
				runtimeMode: thread.codex.runtimeMode,
			},
		});
	}

	async sendMessage(input: LunaSendMessageInput): Promise<{ turnId: string }> {
		this.incrementActiveTurn(input.threadId);
		try {
			return await this.controller.sendMessage(input);
		} catch (error) {
			this.decrementActiveTurn(input.threadId);
			throw error;
		}
	}

	getThread(threadId: string): Promise<LunaThreadRecord | null> {
		return this.controller.getThread(threadId);
	}

	async updateHistory(
		threadId: string,
		history: readonly { role: "user" | "assistant"; content: string }[],
	): Promise<void> {
		const thread = await this.store.getThread(threadId);
		if (!thread) {
			return;
		}
		await this.store.putThread({
			...thread,
			history,
			updatedAt: new Date().toISOString(),
		});
	}

	async updateThreadTitle(threadId: string, title: string): Promise<void> {
		const thread = await this.store.getThread(threadId);
		if (!thread) {
			return;
		}
		await this.store.putThread({
			...thread,
			title,
			updatedAt: new Date().toISOString(),
		});
	}

	async updateThreadWorkspace(
		threadId: string,
		updates: { branch?: string; worktreePath?: string; cwd?: string },
	): Promise<void> {
		const thread = await this.store.getThread(threadId);
		if (!thread) {
			return;
		}
		await this.store.putThread({
			...thread,
			workspace: {
				...thread.workspace,
				branch: updates.branch ?? thread.workspace.branch,
				worktreePath: updates.worktreePath ?? thread.workspace.worktreePath,
				cwd: updates.cwd ?? thread.workspace.cwd,
			},
			updatedAt: new Date().toISOString(),
		});
	}

	listThreads(): Promise<readonly LunaThreadRecord[]> {
		return this.controller.listThreads();
	}

	stopThread(threadId: string): Promise<void> {
		this.activeTurnCounts.delete(threadId);
		this.flushIdleWaiters(threadId);
		return this.controller.stopThread(threadId);
	}

	async listThreadCheckpoints(threadId: string): Promise<readonly string[]> {
		await this.awaitCheckpointWork(threadId);
		const thread = await this.store.getThread(threadId);
		return thread?.workspace.checkpoints ?? [];
	}

	async getLatestThreadCheckpoint(threadId: string): Promise<string | null> {
		const checkpoints = await this.listThreadCheckpoints(threadId);
		return checkpoints.at(-1) ?? null;
	}

	async diffThreadCheckpoints(
		threadId: string,
		input?: { readonly fromCheckpointRef?: string; readonly toCheckpointRef?: string },
	): Promise<string> {
		await this.awaitCheckpointWork(threadId);
		const thread = await this.store.getThread(threadId);
		if (!thread) {
			throw new Error(`Unknown thread: ${threadId}`);
		}

		const checkpointRefs = thread.workspace.checkpoints;
		const toCheckpointRef = input?.toCheckpointRef ?? checkpointRefs.at(-1);
		const fromCheckpointRef = input?.fromCheckpointRef ?? checkpointRefs.at(-2);
		if (!fromCheckpointRef || !toCheckpointRef) {
			throw new Error(`Thread ${threadId} does not have enough checkpoints to diff.`);
		}

		return this.checkpoints.diffCheckpoints({
			cwd: thread.workspace.cwd,
			fromCheckpointRef,
			toCheckpointRef,
		});
	}

	async restoreThreadCheckpoint(threadId: string, checkpointRef?: string): Promise<boolean> {
		await this.awaitCheckpointWork(threadId);
		const thread = await this.store.getThread(threadId);
		if (!thread) {
			throw new Error(`Unknown thread: ${threadId}`);
		}

		const resolvedCheckpointRef = checkpointRef ?? thread.workspace.checkpoints.at(-1);
		if (!resolvedCheckpointRef) {
			throw new Error(`Thread ${threadId} does not have any checkpoints to restore.`);
		}

		return this.checkpoints.restoreCheckpoint({
			cwd: thread.workspace.cwd,
			checkpointRef: resolvedCheckpointRef,
			fallbackToHead: false,
		});
	}

	async deleteThreadCheckpoints(
		threadId: string,
		checkpointRefs?: ReadonlyArray<string>,
	): Promise<void> {
		await this.awaitCheckpointWork(threadId);
		const thread = await this.store.getThread(threadId);
		if (!thread) {
			throw new Error(`Unknown thread: ${threadId}`);
		}

		const resolvedCheckpointRefs = checkpointRefs?.length
			? [...checkpointRefs]
			: [...thread.workspace.checkpoints];
		if (resolvedCheckpointRefs.length === 0) {
			return;
		}

		await this.checkpoints.deleteCheckpointRefs({
			cwd: thread.workspace.cwd,
			checkpointRefs: resolvedCheckpointRefs,
		});
		await this.store.putThread(removeCheckpointRefs(thread, resolvedCheckpointRefs));
	}

	async pruneThreadCheckpoints(threadId: string, keepLastN: number): Promise<void> {
		if (!Number.isInteger(keepLastN) || keepLastN < 0) {
			throw new Error("keepLastN must be a non-negative integer.");
		}

		await this.awaitCheckpointWork(threadId);
		const thread = await this.store.getThread(threadId);
		if (!thread) {
			throw new Error(`Unknown thread: ${threadId}`);
		}

		const checkpointRefs = [...thread.workspace.checkpoints];
		const refsToDelete = checkpointRefs.slice(0, Math.max(0, checkpointRefs.length - keepLastN));
		await this.deleteThreadCheckpoints(threadId, refsToDelete);
	}

	async removeThreadWorktree(
		threadId: string,
		options?: { readonly force?: boolean },
	): Promise<void> {
		await this.awaitCheckpointWork(threadId);
		const thread = await this.store.getThread(threadId);
		if (!thread) {
			throw new Error(`Unknown thread: ${threadId}`);
		}
		if (!thread.workspace.worktreePath) {
			return;
		}

		await this.worktreeManager.removeWorktree(
			thread.repoRoot,
			thread.workspace.worktreePath,
			options?.force ?? true,
		);
	}

	async deleteThread(
		threadId: string,
		options?: {
			readonly removeWorktree?: boolean;
			readonly deleteCheckpoints?: boolean;
			readonly stopSession?: boolean;
		},
	): Promise<void> {
		await this.awaitCheckpointWork(threadId);
		const thread = await this.store.getThread(threadId);
		if (!thread) {
			return;
		}

		if (options?.stopSession ?? true) {
			try {
				await this.stopThread(threadId);
			} catch {
				// ignore stop failures during delete
			}
		}

		if (options?.deleteCheckpoints) {
			await this.deleteThreadCheckpoints(threadId);
		}
		if (options?.removeWorktree && thread.workspace.worktreePath) {
			await this.removeThreadWorktree(threadId, { force: true });
		}
		await this.store.deleteThread(threadId);
	}

	dispose(): void {
		this.unsubscribeCodex();
	}

	async waitForIdle(threadId?: string): Promise<void> {
		if (threadId) {
			await this.awaitThreadIdle(threadId);
			return;
		}

		const threadIds = [
			...new Set([...this.activeTurnCounts.keys(), ...this.checkpointWork.keys()]),
		];
		await Promise.all(threadIds.map(async (id) => this.awaitThreadIdle(id)));
	}

	async generateText(input: LunaGenerateInput): Promise<string> {
		const threadId = input.threadId ?? `gen-${Date.now()}`;
		const repoRoot = input.repoRoot ?? process.cwd();

		let thread = await this.store.getThread(threadId);
		if (!thread) {
			thread = await this.startThread({
				threadId,
				title: "Generation",
				repoRoot,
				worktree: { mode: "repo-root" },
				codex: { model: "gpt-5.4", runtimeMode: "full-access" },
			});
		}

		return new Promise((resolve) => {
			let content = "";

			const unsubscribe = this.on((event) => {
				if (event.threadId === threadId && event.type === "content.delta") {
					content += event.payload.delta;
				}
				if (event.threadId === threadId && event.type === "turn.completed") {
					unsubscribe();
					resolve(content.trim());
				}
				if (event.threadId === threadId && event.type === "turn.aborted") {
					unsubscribe();
					resolve(content.trim());
				}
				if (event.threadId === threadId && event.type === "session.error") {
					unsubscribe();
					resolve(content.trim());
				}
			});

			this.sendMessage({
				threadId,
				text: input.prompt,
				interactionMode: "default",
			}).catch(() => {
				unsubscribe();
				resolve(content.trim());
			});
		});
	}
}
