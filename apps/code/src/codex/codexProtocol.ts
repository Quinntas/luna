import { ApprovalRequestId, ProviderItemId, TurnId, type ProviderRequestKind } from "./typesCore";
import type { JsonRpcNotification, JsonRpcRequest, JsonRpcResponse } from "./codexJsonRpcClient";

export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.method === "string" &&
    (typeof candidate.id === "string" || typeof candidate.id === "number")
  );
}

export function isJsonRpcNotification(value: unknown): value is JsonRpcNotification {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.method === "string" && !Object.hasOwn(candidate, "id");
}

export function isJsonRpcResponse(value: unknown): value is JsonRpcResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const hasId = typeof candidate.id === "string" || typeof candidate.id === "number";
  const hasMethod = typeof candidate.method === "string";
  return hasId && !hasMethod;
}

export function readObject(value: unknown, key?: string): Record<string, unknown> | undefined {
  const target =
    key === undefined
      ? value
      : value && typeof value === "object"
        ? (value as Record<string, unknown>)[key]
        : undefined;

  if (!target || typeof target !== "object") {
    return undefined;
  }

  return target as Record<string, unknown>;
}

export function readArray(value: unknown, key?: string): unknown[] | undefined {
  const target =
    key === undefined
      ? value
      : value && typeof value === "object"
        ? (value as Record<string, unknown>)[key]
        : undefined;
  return Array.isArray(target) ? target : undefined;
}

export function readString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : undefined;
}

export function readBoolean(value: unknown, key: string): boolean | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "boolean" ? candidate : undefined;
}

function brandIfNonEmpty<T extends string>(
  value: string | undefined,
  maker: (value: string) => T,
): T | undefined {
  const normalized = value?.trim();
  return normalized?.length ? maker(normalized) : undefined;
}

export function toTurnId(value: string | undefined): TurnId | undefined {
  return brandIfNonEmpty(value, TurnId.makeUnsafe);
}

export function toProviderItemId(value: string | undefined): ProviderItemId | undefined {
  return brandIfNonEmpty(value, ProviderItemId.makeUnsafe);
}

export function normalizeProviderThreadId(value: string | undefined): string | undefined {
  return brandIfNonEmpty(value, (normalized) => normalized);
}

export function readRouteFields(params: unknown): {
  turnId?: TurnId;
  itemId?: ProviderItemId;
} {
  const route: {
    turnId?: TurnId;
    itemId?: ProviderItemId;
  } = {};

  const turnId = toTurnId(
    readString(params, "turnId") ?? readString(readObject(params, "turn"), "id"),
  );
  const itemId = toProviderItemId(
    readString(params, "itemId") ?? readString(readObject(params, "item"), "id"),
  );

  if (turnId) {
    route.turnId = turnId;
  }

  if (itemId) {
    route.itemId = itemId;
  }

  return route;
}

export function readProviderConversationId(params: unknown): string | undefined {
  return (
    readString(params, "threadId") ??
    readString(readObject(params, "thread"), "id") ??
    readString(params, "conversationId")
  );
}

export function requestKindForMethod(method: string): ProviderRequestKind | undefined {
  if (method === "item/commandExecution/requestApproval") {
    return "command";
  }

  if (method === "item/fileRead/requestApproval") {
    return "file-read";
  }

  if (method === "item/fileChange/requestApproval") {
    return "file-change";
  }

  return undefined;
}

export function shouldSuppressChildConversationNotification(method: string): boolean {
  return (
    method === "thread/started" ||
    method === "thread/status/changed" ||
    method === "thread/archived" ||
    method === "thread/unarchived" ||
    method === "thread/closed" ||
    method === "thread/compacted" ||
    method === "thread/name/updated" ||
    method === "thread/tokenUsage/updated" ||
    method === "turn/started" ||
    method === "turn/completed" ||
    method === "turn/aborted" ||
    method === "turn/plan/updated" ||
    method === "item/plan/delta"
  );
}

export function createApprovalRequestId(): ApprovalRequestId {
  return ApprovalRequestId.makeUnsafe(crypto.randomUUID());
}
