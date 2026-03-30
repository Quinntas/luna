import type { LunaEventId, LunaThreadId } from "./ids";

interface LunaRuntimeEventBase {
  readonly eventId: LunaEventId;
  readonly threadId: LunaThreadId;
  readonly timestamp: string;
  readonly source: "luna" | "codex";
  readonly turnId?: string;
  readonly raw?: unknown;
}

export type LunaRuntimeEvent =
  | (LunaRuntimeEventBase & {
      readonly type: "thread.created";
      readonly payload: { title: string; repoRoot: string };
    })
  | (LunaRuntimeEventBase & {
      readonly type: "workspace.bound";
      readonly payload: {
        cwd: string;
        branch: string | null;
        worktreePath: string | null;
        reused: boolean;
      };
    })
  | (LunaRuntimeEventBase & {
      readonly type: "session.starting" | "session.ready" | "session.closed";
      readonly payload: { cwd: string; providerThreadId: string | null };
    })
  | (LunaRuntimeEventBase & {
      readonly type: "session.exited";
      readonly payload: { reason?: string; exitKind?: string };
    })
  | (LunaRuntimeEventBase & {
      readonly type: "session.error";
      readonly payload: { message: string };
    })
  | (LunaRuntimeEventBase & {
      readonly type: "runtime.warning";
      readonly payload: { message: string; detail?: unknown };
    })
  | (LunaRuntimeEventBase & {
      readonly type: "turn.started";
      readonly payload: { text?: string; model?: string; effort?: string };
    })
  | (LunaRuntimeEventBase & {
      readonly type: "content.delta";
      readonly payload: { delta: string; streamKind?: string };
    })
  | (LunaRuntimeEventBase & {
      readonly type: "request.opened";
      readonly payload: { requestId: string; requestType: string };
    })
  | (LunaRuntimeEventBase & {
      readonly type: "request.resolved";
      readonly payload: { requestId: string };
    })
  | (LunaRuntimeEventBase & {
      readonly type: "turn.completed";
      readonly payload: Record<string, unknown>;
    })
  | (LunaRuntimeEventBase & {
      readonly type: "turn.aborted";
      readonly payload: { reason: string };
    })
  | (LunaRuntimeEventBase & {
      readonly type: "turn.plan.updated";
      readonly payload: Record<string, unknown>;
    })
  | (LunaRuntimeEventBase & {
      readonly type: "checkpoint.captured";
      readonly payload: { checkpointRef: string; cwd: string; sequence: number };
    })
  | (LunaRuntimeEventBase & {
      readonly type: "checkpoint.error";
      readonly payload: { message: string; cwd: string; sequence: number };
    });
