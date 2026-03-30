import { EventEmitter } from "node:events";

import { resolveRuntimeAttachment } from "./codexAttachments";
import { CodexRequestError } from "./codexErrors";
import { CodexAppServerManager, type CodexAppServerManagerOptions } from "./managerCore";
import { mapToRuntimeEvents } from "./runtimeEventsCore";
import type {
	CodexRuntimeEvent,
	CodexRuntimeSendTurnInput,
	CodexRuntimeSession,
	CodexRuntimeStartSessionInput,
	CodexTurnStartResult,
	NativeCodexEvent,
	ProviderApprovalDecision,
	ProviderUserInputAnswers,
	ThreadId,
	TurnId,
} from "./typesCore";

export interface CodexRuntimeEvents {
	nativeEvent: [event: NativeCodexEvent];
	runtimeEvent: [event: CodexRuntimeEvent];
}

export interface CodexRuntimeOptions extends CodexAppServerManagerOptions {
	readonly manager?: CodexAppServerManager;
}

export class CodexRuntime extends EventEmitter<CodexRuntimeEvents> {
	readonly manager: CodexAppServerManager;

	constructor(options?: CodexRuntimeOptions) {
		super();
		this.manager = options?.manager ?? new CodexAppServerManager(options);
		this.manager.on("event", (event) => {
			this.emit("nativeEvent", event);
			for (const runtimeEvent of mapToRuntimeEvents(event, event.threadId)) {
				this.emit("runtimeEvent", runtimeEvent);
			}
		});
	}

	async startSession(input: CodexRuntimeStartSessionInput): Promise<CodexRuntimeSession> {
		return this.manager.startSession({
			threadId: input.threadId,
			cwd: input.cwd,
			model: input.model,
			resumeCursor: input.resumeCursor,
			runtimeMode: input.runtimeMode,
			providerOptions: input.providerOptions ? { codex: input.providerOptions } : undefined,
			serviceTier: input.serviceTier,
		});
	}

	async sendTurn(input: CodexRuntimeSendTurnInput): Promise<CodexTurnStartResult> {
		try {
			const attachments = input.attachments
				? await Promise.all(
						input.attachments.map((attachment) => resolveRuntimeAttachment(attachment)),
					)
				: undefined;

			return await this.manager.sendTurn({
				threadId: input.threadId,
				input: input.input,
				attachments,
				model: input.model,
				serviceTier: input.fastMode ? "fast" : input.serviceTier,
				effort: input.reasoningEffort,
				interactionMode: input.interactionMode,
			});
		} catch (error) {
			throw new CodexRequestError(
				"turn/start",
				error instanceof Error ? error.message : "Failed to send Codex turn.",
				{ cause: error },
			);
		}
	}

	interruptTurn(threadId: ThreadId, turnId?: TurnId): Promise<void> {
		return this.manager.interruptTurn(threadId, turnId);
	}

	respondToRequest(
		threadId: ThreadId,
		requestId: string,
		decision: ProviderApprovalDecision,
	): Promise<void> {
		return this.manager.respondToRequest(threadId, requestId, decision);
	}

	respondToUserInput(
		threadId: ThreadId,
		requestId: string,
		answers: ProviderUserInputAnswers,
	): Promise<void> {
		return this.manager.respondToUserInput(threadId, requestId, answers);
	}

	readThread(threadId: ThreadId) {
		return this.manager.readThread(threadId);
	}

	rollbackThread(threadId: ThreadId, numTurns: number) {
		return this.manager.rollbackThread(threadId, numTurns);
	}

	stopSession(threadId: ThreadId) {
		this.manager.stopSession(threadId);
	}

	stopAll() {
		this.manager.stopAll();
	}

	listSessions() {
		return this.manager.listSessions();
	}

	hasSession(threadId: ThreadId) {
		return this.manager.hasSession(threadId);
	}
}
