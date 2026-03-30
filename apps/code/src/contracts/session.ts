import type { LunaThreadId } from "./ids";
import type { LunaWorktreeRequest } from "./worktree";

export interface LunaStartThreadInput {
  readonly threadId: LunaThreadId;
  readonly title?: string;
  readonly repoRoot: string;
  readonly worktree?: LunaWorktreeRequest;
  readonly codex?: {
    readonly model?: string;
    readonly runtimeMode?: "approval-required" | "full-access";
    readonly binaryPath?: string;
    readonly homePath?: string;
  };
}

export interface LunaSendMessageInput {
  readonly threadId: LunaThreadId;
  readonly text: string;
  readonly interactionMode?: "default" | "plan";
  readonly reasoningEffort?: string;
}
