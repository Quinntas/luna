import { randomUUID } from "node:crypto";

import {
  EventId,
  type NativeCodexEvent as ProviderEvent,
  type CodexSession as ProviderSession,
} from "./typesCore";
import {
  normalizeProviderThreadId,
  readBoolean,
  readObject,
  readRouteFields,
  readString,
  shouldSuppressChildConversationNotification,
  toTurnId,
} from "./codexProtocol";
import { readChildParentTurnId, rememberCollabReceiverTurns } from "./codexThreadState";
import type { JsonRpcNotification } from "./codexJsonRpcClient";

export interface CodexNotificationContext {
  readonly threadId: string;
  readonly collabReceiverTurns: Map<string, string>;
  readonly session: ProviderSession;
}

export interface CodexNotificationHandlingResult {
  readonly events: readonly ProviderEvent[];
  readonly sessionUpdates?: Partial<ProviderSession>;
}

export function handleCodexNotification(
  context: CodexNotificationContext,
  notification: JsonRpcNotification,
): CodexNotificationHandlingResult {
  const rawRoute = readRouteFields(notification.params);
  rememberCollabReceiverTurns(context.collabReceiverTurns, notification.params, rawRoute.turnId);
  const childParentTurnId = readChildParentTurnId(context.collabReceiverTurns, notification.params);
  const isChildConversation = childParentTurnId !== undefined;
  if (isChildConversation && shouldSuppressChildConversationNotification(notification.method)) {
    return { events: [] };
  }

  const textDelta =
    notification.method === "item/agentMessage/delta"
      ? readString(notification.params, "delta")
      : undefined;

  const baseEvent: ProviderEvent = {
    id: EventId.makeUnsafe(randomUUID()),
    kind: "notification",
    provider: "codex",
    threadId: context.threadId,
    createdAt: new Date().toISOString(),
    method: notification.method,
    ...((childParentTurnId ?? rawRoute.turnId)
      ? { turnId: childParentTurnId ?? rawRoute.turnId }
      : {}),
    ...(rawRoute.itemId ? { itemId: rawRoute.itemId } : {}),
    ...(textDelta ? { textDelta } : {}),
    payload: notification.params,
  };

  if (notification.method === "thread/started") {
    const providerThreadId = normalizeProviderThreadId(
      readString(readObject(notification.params)?.thread, "id"),
    );
    return {
      events: [baseEvent],
      sessionUpdates: providerThreadId
        ? { resumeCursor: { threadId: providerThreadId } }
        : undefined,
    };
  }

  if (notification.method === "turn/started") {
    if (isChildConversation) {
      return { events: [baseEvent] };
    }
    const turnId = toTurnId(readString(readObject(notification.params)?.turn, "id"));
    return {
      events: [baseEvent],
      sessionUpdates: {
        status: "running",
        activeTurnId: turnId,
      },
    };
  }

  if (notification.method === "turn/completed") {
    if (isChildConversation) {
      return { events: [baseEvent] };
    }
    context.collabReceiverTurns.clear();
    const turn = readObject(notification.params, "turn");
    const status = readString(turn, "status");
    const errorMessage = readString(readObject(turn, "error"), "message");
    return {
      events: [baseEvent],
      sessionUpdates: {
        status: status === "failed" ? "error" : "ready",
        activeTurnId: undefined,
        lastError: errorMessage ?? context.session.lastError,
      },
    };
  }

  if (notification.method === "error") {
    if (isChildConversation) {
      return { events: [baseEvent] };
    }
    const message = readString(readObject(notification.params)?.error, "message");
    const willRetry = readBoolean(notification.params, "willRetry");
    return {
      events: [baseEvent],
      sessionUpdates: {
        status: willRetry ? "running" : "error",
        lastError: message ?? context.session.lastError,
      },
    };
  }

  return { events: [baseEvent] };
}
