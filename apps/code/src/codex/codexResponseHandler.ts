import { randomUUID } from "node:crypto";

import {
  EventId,
  type ApprovalRequestId,
  type NativeCodexEvent as ProviderEvent,
  type ProviderApprovalDecision,
  type ProviderUserInputAnswers,
} from "./typesCore";
import type { PendingApprovalRequest, PendingUserInputRequest } from "./codexRequestHandler";

interface CodexUserInputAnswer {
  answers: string[];
}

function toCodexUserInputAnswer(value: unknown): CodexUserInputAnswer {
  if (typeof value === "string") {
    return { answers: [value] };
  }

  if (Array.isArray(value)) {
    const answers = value.filter((entry): entry is string => typeof entry === "string");
    return { answers };
  }

  if (value && typeof value === "object") {
    const maybeAnswers = (value as { answers?: unknown }).answers;
    if (Array.isArray(maybeAnswers)) {
      const answers = maybeAnswers.filter((entry): entry is string => typeof entry === "string");
      return { answers };
    }
  }

  throw new Error("User input answers must be strings or arrays of strings.");
}

function toCodexUserInputAnswers(
  answers: ProviderUserInputAnswers,
): Record<string, CodexUserInputAnswer> {
  return Object.fromEntries(
    Object.entries(answers).map(([questionId, value]) => [
      questionId,
      toCodexUserInputAnswer(value),
    ]),
  );
}

export function buildApprovalResponse(input: {
  readonly threadId: string;
  readonly pendingRequest: PendingApprovalRequest;
  readonly decision: ProviderApprovalDecision;
}): { message: unknown; event: ProviderEvent } {
  return {
    message: {
      id: input.pendingRequest.jsonRpcId,
      result: {
        decision: input.decision,
      },
    },
    event: {
      id: EventId.makeUnsafe(randomUUID()),
      kind: "notification",
      provider: "codex",
      threadId: input.threadId,
      createdAt: new Date().toISOString(),
      method: "item/requestApproval/decision",
      turnId: input.pendingRequest.turnId,
      itemId: input.pendingRequest.itemId,
      requestId: input.pendingRequest.requestId,
      requestKind: input.pendingRequest.requestKind,
      payload: {
        requestId: input.pendingRequest.requestId,
        requestKind: input.pendingRequest.requestKind,
        decision: input.decision,
      },
    },
  };
}

export function buildUserInputResponse(input: {
  readonly threadId: string;
  readonly pendingRequest: PendingUserInputRequest;
  readonly answers: ProviderUserInputAnswers;
}): { message: unknown; event: ProviderEvent } {
  const codexAnswers = toCodexUserInputAnswers(input.answers);
  return {
    message: {
      id: input.pendingRequest.jsonRpcId,
      result: {
        answers: codexAnswers,
      },
    },
    event: {
      id: EventId.makeUnsafe(randomUUID()),
      kind: "notification",
      provider: "codex",
      threadId: input.threadId,
      createdAt: new Date().toISOString(),
      method: "item/tool/requestUserInput/answered",
      turnId: input.pendingRequest.turnId,
      itemId: input.pendingRequest.itemId,
      requestId: input.pendingRequest.requestId,
      payload: {
        requestId: input.pendingRequest.requestId,
        answers: codexAnswers,
      },
    },
  };
}

export type { PendingApprovalRequest, PendingUserInputRequest, ApprovalRequestId };
