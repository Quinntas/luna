import type { LunaRuntimeEvent } from "../contracts/events";
import type { LunaThreadId } from "../contracts/ids";
import type { CodexSessionRuntime, LunaLogger } from "../contracts/ports";
import type { LunaSendMessageInput } from "../contracts/session";
import { mapCodexEventToLuna } from "./codexEventMapper";
import { CodexRuntime } from "./runtimeCore";
import type { CodexRuntimeEvent } from "./typesCore";

export interface CodexAdapterOptions {
	readonly logger?: LunaLogger;
}

export class CodexSessionAdapter implements CodexSessionRuntime {
	private readonly runtime: CodexRuntime;
	private readonly listeners = new Set<(event: LunaRuntimeEvent) => void>();
	private readonly providerToLunaThread = new Map<string, LunaThreadId>();

	constructor(options?: CodexAdapterOptions) {
		this.runtime = new CodexRuntime({
			logger: options?.logger,
		});

		this.runtime.on("runtimeEvent", (event) => {
			this.forwardEvent(event);
		});
	}

	private forwardEvent(event: CodexRuntimeEvent) {
		const threadId = this.providerToLunaThread.get(event.threadId) ?? event.threadId;
		const mapped = mapCodexEventToLuna(threadId, event);
		if (!mapped) return;
		for (const listener of this.listeners) {
			listener({
				...mapped,
				eventId: mapped.eventId ?? crypto.randomUUID(),
				timestamp: mapped.timestamp ?? new Date().toISOString(),
			});
		}
	}

	onEvent(listener: (event: LunaRuntimeEvent) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	async startSession(input: {
		readonly threadId: LunaThreadId;
		readonly providerThreadId?: string | null;
		readonly cwd: string;
		readonly model?: string;
		readonly runtimeMode: "approval-required" | "full-access";
		readonly binaryPath?: string;
		readonly homePath?: string;
	}): Promise<{ providerThreadId: string | null }> {
		const session = await this.runtime.startSession({
			threadId: input.providerThreadId ?? input.threadId,
			cwd: input.cwd,
			model: input.model,
			runtimeMode: input.runtimeMode,
			providerOptions: {
				binaryPath: input.binaryPath,
				homePath: input.homePath,
			},
		});
		this.providerToLunaThread.set(session.threadId, input.threadId);
		return { providerThreadId: session.threadId };
	}

	async sendMessage(input: LunaSendMessageInput): Promise<{ turnId: string }> {
		const providerThreadId =
			[...this.providerToLunaThread.entries()].find(([, value]) => value === input.threadId)?.[0] ??
			input.threadId;
		const result = await this.runtime.sendTurn({
			threadId: providerThreadId,
			input: input.text,
			interactionMode: input.interactionMode,
			reasoningEffort: input.reasoningEffort,
		});
		return { turnId: result.turnId };
	}

	async stopSession(threadId: LunaThreadId): Promise<void> {
		const providerThreadId =
			[...this.providerToLunaThread.entries()].find(([, value]) => value === threadId)?.[0] ??
			threadId;
		this.runtime.stopSession(providerThreadId);
	}
}
