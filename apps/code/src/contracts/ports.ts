import type { Logger } from "pino";

import type { LunaRuntimeEvent } from "./events";
import type { LunaThreadId } from "./ids";
import type { LunaSendMessageInput, LunaStartThreadInput } from "./session";
import type { LunaThreadRecord } from "./thread";
import type { LunaWorktreeBinding } from "./worktree";

export type LunaLogger = Logger;

export interface ThreadStore {
	getThread(threadId: LunaThreadId): Promise<LunaThreadRecord | null>;
	putThread(thread: LunaThreadRecord): Promise<void>;
	deleteThread(threadId: LunaThreadId): Promise<void>;
	listThreads(): Promise<readonly LunaThreadRecord[]>;
}

export interface WorktreeProvisioner {
	ensureBinding(input: LunaStartThreadInput): Promise<LunaWorktreeBinding>;
}

export interface CodexSessionRuntime {
	startSession(input: {
		readonly threadId: LunaThreadId;
		readonly providerThreadId?: string | null;
		readonly cwd: string;
		readonly model?: string;
		readonly runtimeMode: "approval-required" | "full-access";
		readonly binaryPath?: string;
		readonly homePath?: string;
	}): Promise<{ providerThreadId: string | null }>;
	sendMessage(input: LunaSendMessageInput): Promise<{ turnId: string }>;
	stopSession(threadId: LunaThreadId): Promise<void>;
	onEvent(listener: (event: LunaRuntimeEvent) => void): () => void;
}
