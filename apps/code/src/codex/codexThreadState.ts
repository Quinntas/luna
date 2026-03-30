import { TurnId } from "./typesCore";
import {
  normalizeProviderThreadId,
  readArray,
  readObject,
  readProviderConversationId,
  readString,
} from "./codexProtocol";

export interface CodexThreadTurnSnapshot {
  id: TurnId;
  items: unknown[];
}

export interface CodexThreadSnapshot {
  threadId: string;
  turns: CodexThreadTurnSnapshot[];
}

export function parseThreadSnapshot(method: string, response: unknown): CodexThreadSnapshot {
  const responseRecord = readObject(response);
  const thread = readObject(responseRecord, "thread");
  const threadIdRaw = readString(thread, "id") ?? readString(responseRecord, "threadId");
  if (!threadIdRaw) {
    throw new Error(`${method} response did not include a thread id.`);
  }
  const turnsRaw = readArray(thread, "turns") ?? readArray(responseRecord, "turns") ?? [];
  const turns = turnsRaw.map((turnValue, index) => {
    const turn = readObject(turnValue);
    const turnIdRaw = readString(turn, "id") ?? `${threadIdRaw}:turn:${index + 1}`;
    const turnId = TurnId.makeUnsafe(turnIdRaw);
    const items = readArray(turn, "items") ?? [];
    return {
      id: turnId,
      items,
    };
  });

  return {
    threadId: threadIdRaw,
    turns,
  };
}

export function readChildParentTurnId(
  collabReceiverTurns: ReadonlyMap<string, TurnId>,
  params: unknown,
): TurnId | undefined {
  const providerConversationId = readProviderConversationId(params);
  if (!providerConversationId) {
    return undefined;
  }
  return collabReceiverTurns.get(providerConversationId);
}

export function rememberCollabReceiverTurns(
  collabReceiverTurns: Map<string, TurnId>,
  params: unknown,
  parentTurnId: TurnId | undefined,
): void {
  if (!parentTurnId) {
    return;
  }
  const payload = readObject(params);
  const item = readObject(payload, "item") ?? payload;
  const itemType = readString(item, "type") ?? readString(item, "kind");
  if (itemType !== "collabAgentToolCall") {
    return;
  }

  const receiverThreadIds =
    readArray(item, "receiverThreadIds")
      ?.map((value) =>
        typeof value === "string" ? (normalizeProviderThreadId(value) ?? null) : null,
      )
      .filter((value): value is string => value !== null) ?? [];
  for (const receiverThreadId of receiverThreadIds) {
    collabReceiverTurns.set(receiverThreadId, parentTurnId);
  }
}
