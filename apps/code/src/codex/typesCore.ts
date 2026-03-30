export type ThreadId = string;
export type TurnId = string;
export type ProviderItemId = string;
export type ApprovalRequestId = string;
export type EventId = string;
export type RuntimeItemId = string;
export type RuntimeRequestId = string;
export type RuntimeTaskId = string;

export const ThreadId = { makeUnsafe: (value: string) => value as ThreadId };
export const TurnId = { makeUnsafe: (value: string) => value as TurnId };
export const ProviderItemId = { makeUnsafe: (value: string) => value as ProviderItemId };
export const ApprovalRequestId = { makeUnsafe: (value: string) => value as ApprovalRequestId };
export const EventId = { makeUnsafe: (value: string) => value as EventId };
export const RuntimeItemId = { makeUnsafe: (value: string) => value as RuntimeItemId };
export const RuntimeRequestId = { makeUnsafe: (value: string) => value as RuntimeRequestId };
export const RuntimeTaskId = { makeUnsafe: (value: string) => value as RuntimeTaskId };

export type RuntimeMode = "approval-required" | "full-access";
export type ProviderInteractionMode = "default" | "plan";
export type ProviderRequestKind = "command" | "file-read" | "file-change";
export type ProviderApprovalDecision = "accept" | "acceptForSession" | "decline" | "cancel";
export type ProviderUserInputAnswers = Record<string, unknown>;

export function isProviderApprovalDecision(value: unknown): value is ProviderApprovalDecision {
	return (
		value === "accept" || value === "acceptForSession" || value === "decline" || value === "cancel"
	);
}

export type CodexProviderStartOptions = {
	readonly binaryPath?: string;
	readonly homePath?: string;
};

export type CodexSessionStatus = "connecting" | "ready" | "running" | "error" | "closed";

export interface CodexSession {
	readonly provider: "codex";
	readonly status: CodexSessionStatus;
	readonly runtimeMode: RuntimeMode;
	readonly cwd?: string;
	readonly model?: string;
	readonly threadId: ThreadId;
	readonly resumeCursor?: unknown;
	readonly activeTurnId?: TurnId;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly lastError?: string;
}

export interface CodexSessionStartInput {
	readonly threadId: ThreadId;
	readonly provider?: "codex";
	readonly cwd?: string;
	readonly modelSelection?: {
		readonly provider: "codex";
		readonly model: string;
		readonly options?: {
			readonly fastMode?: boolean;
			readonly reasoningEffort?: string;
		};
	};
	readonly resumeCursor?: unknown;
	readonly providerOptions?: {
		readonly codex?: CodexProviderStartOptions;
	};
	readonly runtimeMode: RuntimeMode;
}

export interface CodexTurnStartResult {
	readonly threadId: ThreadId;
	readonly turnId: TurnId;
	readonly resumeCursor?: unknown;
}

export interface NativeCodexEvent {
	readonly id: EventId;
	readonly kind: "session" | "notification" | "request" | "error";
	readonly provider: "codex";
	readonly threadId: ThreadId;
	readonly createdAt: string;
	readonly method: string;
	readonly message?: string;
	readonly turnId?: TurnId;
	readonly itemId?: ProviderItemId;
	readonly requestId?: ApprovalRequestId;
	readonly requestKind?: ProviderRequestKind;
	readonly textDelta?: string;
	readonly payload?: unknown;
}

export type CanonicalItemType =
	| "user_message"
	| "assistant_message"
	| "reasoning"
	| "plan"
	| "command_execution"
	| "file_change"
	| "mcp_tool_call"
	| "dynamic_tool_call"
	| "collab_agent_tool_call"
	| "web_search"
	| "image_view"
	| "review_entered"
	| "review_exited"
	| "context_compaction"
	| "error"
	| "unknown";

export type CanonicalRequestType =
	| "command_execution_approval"
	| "file_read_approval"
	| "file_change_approval"
	| "apply_patch_approval"
	| "exec_command_approval"
	| "tool_user_input"
	| "dynamic_tool_call"
	| "auth_tokens_refresh"
	| "unknown";

export interface ThreadTokenUsageSnapshot {
	readonly usedTokens: number;
	readonly totalProcessedTokens?: number;
	readonly maxTokens?: number;
	readonly inputTokens?: number;
	readonly cachedInputTokens?: number;
	readonly outputTokens?: number;
	readonly reasoningOutputTokens?: number;
	readonly lastUsedTokens?: number;
	readonly lastInputTokens?: number;
	readonly lastCachedInputTokens?: number;
	readonly lastOutputTokens?: number;
	readonly lastReasoningOutputTokens?: number;
	readonly compactsAutomatically?: boolean;
}

export interface CodexRuntimeEvent {
	readonly eventId: EventId;
	readonly provider: "codex";
	readonly threadId: ThreadId;
	readonly createdAt: string;
	readonly turnId?: TurnId;
	readonly itemId?: RuntimeItemId;
	readonly requestId?: RuntimeRequestId;
	readonly providerRefs?: {
		readonly providerTurnId?: string;
		readonly providerItemId?: string;
		readonly providerRequestId?: string;
	};
	readonly raw?: {
		readonly source:
			| "codex.app-server.notification"
			| "codex.app-server.request"
			| "codex.eventmsg"
			| "codex.sdk.thread-event";
		readonly method?: string;
		readonly messageType?: string;
		readonly payload: unknown;
	};
	readonly type: string;
	readonly payload: Record<string, unknown>;
}

export interface RuntimeImageAttachment {
	readonly type: "image";
	readonly url: string;
}

export type RuntimeAttachmentInput =
	| { readonly type: "image"; readonly url: string }
	| { readonly type: "image"; readonly path: string; readonly mimeType?: string };

export interface CodexRuntimeStartSessionInput {
	readonly threadId: ThreadId;
	readonly cwd?: string;
	readonly model?: string;
	readonly resumeCursor?: unknown;
	readonly runtimeMode: RuntimeMode;
	readonly providerOptions?: CodexProviderStartOptions;
	readonly serviceTier?: string;
}

export interface CodexRuntimeSendTurnInput {
	readonly threadId: ThreadId;
	readonly input?: string;
	readonly attachments?: ReadonlyArray<RuntimeAttachmentInput>;
	readonly model?: string;
	readonly reasoningEffort?: string;
	readonly fastMode?: boolean;
	readonly serviceTier?: string | null;
	readonly interactionMode?: ProviderInteractionMode;
}

export type CodexRuntimeSession = CodexSession;
