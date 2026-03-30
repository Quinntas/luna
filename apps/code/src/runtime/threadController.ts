import { LunaSessionError, LunaStorageError } from "../contracts/errors";
import type {
	CodexSessionRuntime,
	LunaLogger,
	ThreadStore,
	WorktreeProvisioner,
} from "../contracts/ports";
import type { LunaSendMessageInput, LunaStartThreadInput } from "../contracts/session";
import type { LunaThreadRecord } from "../contracts/thread";
import type { LunaEventBus } from "./eventBus";
import {
	applyWorkspaceBinding,
	createInitialThreadRecord,
	markSessionClosed,
	markSessionError,
	markSessionReady,
	markSessionStarting,
} from "./threadState";

export interface ThreadControllerOptions {
	readonly store: ThreadStore;
	readonly worktree: WorktreeProvisioner;
	readonly codex: CodexSessionRuntime;
	readonly events: LunaEventBus;
	readonly logger?: LunaLogger;
}

export class ThreadController {
	private readonly store: ThreadStore;
	private readonly worktree: WorktreeProvisioner;
	private readonly codex: CodexSessionRuntime;
	private readonly events: LunaEventBus;
	private readonly logger?: LunaLogger;

	constructor(options: ThreadControllerOptions) {
		this.store = options.store;
		this.worktree = options.worktree;
		this.codex = options.codex;
		this.events = options.events;
		this.logger = options.logger;
	}

	async startThread(input: LunaStartThreadInput): Promise<LunaThreadRecord> {
		let thread = (await this.store.getThread(input.threadId)) ?? createInitialThreadRecord(input);
		if (!(await this.store.getThread(thread.id))) {
			await this.store.putThread(thread);
			this.events.emit({
				threadId: thread.id,
				source: "luna",
				type: "thread.created",
				payload: { title: thread.title, repoRoot: thread.repoRoot },
			});
		}

		const binding = await this.worktree.ensureBinding(input);
		thread = applyWorkspaceBinding(thread, binding);
		await this.store.putThread(thread);
		this.events.emit({
			threadId: thread.id,
			source: "luna",
			type: "workspace.bound",
			payload: {
				cwd: binding.cwd,
				branch: binding.branch,
				worktreePath: binding.worktreePath,
				reused: binding.reused,
			},
		});

		thread = markSessionStarting(thread);
		await this.store.putThread(thread);
		this.events.emit({
			threadId: thread.id,
			source: "luna",
			type: "session.starting",
			payload: { cwd: thread.workspace.cwd, providerThreadId: thread.codex.providerThreadId },
		});

		try {
			const session = await this.codex.startSession({
				threadId: thread.id,
				providerThreadId: thread.codex.providerThreadId,
				cwd: thread.workspace.cwd,
				model: input.codex?.model ?? thread.codex.model ?? undefined,
				runtimeMode: input.codex?.runtimeMode ?? thread.codex.runtimeMode,
				binaryPath: input.codex?.binaryPath,
				homePath: input.codex?.homePath,
			});
			thread = markSessionReady(thread, session.providerThreadId);
			await this.store.putThread(thread);
			this.events.emit({
				threadId: thread.id,
				source: "luna",
				type: "session.ready",
				payload: { cwd: thread.workspace.cwd, providerThreadId: session.providerThreadId },
			});
			return thread;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			thread = markSessionError(thread, message);
			await this.store.putThread(thread);
			this.events.emit({
				threadId: thread.id,
				source: "luna",
				type: "session.error",
				payload: { message },
			});
			throw new LunaSessionError("Failed to start Luna thread.", { cause: error });
		}
	}

	async sendMessage(input: LunaSendMessageInput): Promise<{ turnId: string }> {
		const thread = await this.store.getThread(input.threadId);
		if (!thread) {
			throw new LunaStorageError(`Unknown thread: ${input.threadId}`);
		}
		if (thread.codex.sessionStatus !== "ready" && thread.codex.sessionStatus !== "running") {
			throw new LunaSessionError(`Thread ${input.threadId} has no ready Codex session.`);
		}

		this.events.emit({
			threadId: input.threadId,
			source: "luna",
			type: "turn.started",
			payload: { text: input.text },
		});

		const result = await this.codex.sendMessage(input);
		return result;
	}

	async stopThread(threadId: string): Promise<void> {
		const thread = await this.store.getThread(threadId);
		if (!thread) {
			throw new LunaStorageError(`Unknown thread: ${threadId}`);
		}
		await this.codex.stopSession(threadId);
		const closed = markSessionClosed(thread);
		await this.store.putThread(closed);
		this.events.emit({
			threadId,
			source: "luna",
			type: "session.closed",
			payload: { cwd: closed.workspace.cwd, providerThreadId: closed.codex.providerThreadId },
		});
	}

	async getThread(threadId: string): Promise<LunaThreadRecord | null> {
		return this.store.getThread(threadId);
	}

	async listThreads(): Promise<readonly LunaThreadRecord[]> {
		return this.store.listThreads();
	}
}
