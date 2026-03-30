import type { CodexRuntimeEvent } from "./typesCore";
import type { LunaRuntimeEvent } from "../contracts/events";
import type { LunaThreadId } from "../contracts/ids";

export function mapCodexEventToLuna(
  threadId: LunaThreadId,
  event: CodexRuntimeEvent,
): LunaRuntimeEvent | null {
  if (event.type === "turn.started") {
    return {
      threadId,
      source: "codex",
      type: "turn.started",
      turnId: event.turnId,
      raw: event,
      payload: {
        ...(typeof event.payload.model === "string" ? { model: event.payload.model } : {}),
        ...(typeof event.payload.effort === "string" ? { effort: event.payload.effort } : {}),
      },
    } as Omit<LunaRuntimeEvent, "eventId" | "timestamp"> as LunaRuntimeEvent;
  }

  if (event.type === "content.delta") {
    return {
      threadId,
      source: "codex",
      type: "content.delta",
      turnId: event.turnId,
      raw: event,
      payload: {
        delta: typeof event.payload.delta === "string" ? event.payload.delta : "",
        streamKind:
          typeof event.payload.streamKind === "string" ? event.payload.streamKind : undefined,
      },
    } as Omit<LunaRuntimeEvent, "eventId" | "timestamp"> as LunaRuntimeEvent;
  }

  if (
    event.type === "request.started" ||
    event.type === "request.created" ||
    event.type === "request.opened" ||
    event.type === "user-input.requested"
  ) {
    return {
      threadId,
      source: "codex",
      type: "request.opened",
      turnId: event.turnId,
      raw: event,
      payload: {
        requestId: event.requestId ?? "unknown",
        requestType:
          typeof event.payload.type === "string"
            ? event.payload.type
            : event.type === "user-input.requested"
              ? "user-input"
              : "unknown",
      },
    } as Omit<LunaRuntimeEvent, "eventId" | "timestamp"> as LunaRuntimeEvent;
  }

  if (
    event.type === "request.completed" ||
    event.type === "request.resolved" ||
    event.type === "user-input.resolved"
  ) {
    return {
      threadId,
      source: "codex",
      type: "request.resolved",
      turnId: event.turnId,
      raw: event,
      payload: { requestId: event.requestId ?? "unknown" },
    } as Omit<LunaRuntimeEvent, "eventId" | "timestamp"> as LunaRuntimeEvent;
  }

  if (event.type === "turn.completed") {
    return {
      threadId,
      source: "codex",
      type: "turn.completed",
      turnId: event.turnId,
      raw: event,
      payload: event.payload,
    } as Omit<LunaRuntimeEvent, "eventId" | "timestamp"> as LunaRuntimeEvent;
  }

  if (event.type === "turn.aborted") {
    return {
      threadId,
      source: "codex",
      type: "turn.aborted",
      turnId: event.turnId,
      raw: event,
      payload: {
        reason: typeof event.payload.reason === "string" ? event.payload.reason : "Turn aborted",
      },
    } as Omit<LunaRuntimeEvent, "eventId" | "timestamp"> as LunaRuntimeEvent;
  }

  if (event.type === "turn.plan.updated") {
    return {
      threadId,
      source: "codex",
      type: "turn.plan.updated",
      turnId: event.turnId,
      raw: event,
      payload: event.payload,
    } as Omit<LunaRuntimeEvent, "eventId" | "timestamp"> as LunaRuntimeEvent;
  }

  if (event.type === "session.exited") {
    return {
      threadId,
      source: "codex",
      type: "session.exited",
      turnId: event.turnId,
      raw: event,
      payload: {
        ...(typeof event.payload.reason === "string" ? { reason: event.payload.reason } : {}),
        ...(typeof event.payload.exitKind === "string" ? { exitKind: event.payload.exitKind } : {}),
      },
    } as Omit<LunaRuntimeEvent, "eventId" | "timestamp"> as LunaRuntimeEvent;
  }

  if (event.type === "runtime.error") {
    return {
      threadId,
      source: "codex",
      type: "session.error",
      turnId: event.turnId,
      raw: event,
      payload: {
        message:
          typeof event.payload.message === "string"
            ? event.payload.message
            : "Provider runtime error",
      },
    } as Omit<LunaRuntimeEvent, "eventId" | "timestamp"> as LunaRuntimeEvent;
  }

  if (event.type === "runtime.warning") {
    return {
      threadId,
      source: "codex",
      type: "runtime.warning",
      turnId: event.turnId,
      raw: event,
      payload: {
        message:
          typeof event.payload.message === "string"
            ? event.payload.message
            : "Provider runtime warning",
        ...(Object.hasOwn(event.payload, "detail") ? { detail: event.payload.detail } : {}),
      },
    } as Omit<LunaRuntimeEvent, "eventId" | "timestamp"> as LunaRuntimeEvent;
  }

  return null;
}
