import { describe, expect, it } from "bun:test";

import { handleCodexNotification } from "../src/codex/codexNotificationHandler";
import { handleCodexRequest } from "../src/codex/codexRequestHandler";
import { buildApprovalResponse, buildUserInputResponse } from "../src/codex/codexResponseHandler";
import type { CodexSession } from "../src/codex/typesCore";

function makeSession(): CodexSession {
	return {
		provider: "codex",
		status: "ready",
		runtimeMode: "approval-required",
		threadId: "thread-1",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	};
}

describe("codex handlers", () => {
	it("maps notifications into events and session updates", () => {
		const result = handleCodexNotification(
			{
				threadId: "thread-1",
				collabReceiverTurns: new Map(),
				session: makeSession(),
			},
			{
				method: "turn/started",
				params: {
					turn: { id: "turn-1" },
				},
			},
		);

		expect(result.events).toHaveLength(1);
		expect(result.events[0]?.method).toBe("turn/started");
		expect(result.sessionUpdates).toMatchObject({ status: "running", activeTurnId: "turn-1" });
	});

	it("creates approval request tracking data", () => {
		const result = handleCodexRequest({
			threadId: "thread-1",
			collabReceiverTurns: new Map(),
			request: {
				id: 1,
				method: "item/fileRead/requestApproval",
				params: {
					turn: { id: "turn-1" },
					item: { id: "item-1" },
				},
			},
		});

		expect(result.pendingApproval?.requestKind).toBe("file-read");
		expect(result.event.kind).toBe("request");
		expect(result.unsupportedResponse).toBeUndefined();
	});

	it("builds approval and user-input response payloads", () => {
		const approval = buildApprovalResponse({
			threadId: "thread-1",
			pendingRequest: {
				requestId: "request-1",
				jsonRpcId: 1,
				method: "item/fileRead/requestApproval",
				requestKind: "file-read",
				threadId: "thread-1",
			},
			decision: "accept",
		});
		const userInput = buildUserInputResponse({
			threadId: "thread-1",
			pendingRequest: {
				requestId: "request-2",
				jsonRpcId: 2,
				threadId: "thread-1",
			},
			answers: { target: "auth.ts" },
		});

		expect(approval.event.method).toBe("item/requestApproval/decision");
		expect(userInput.event.method).toBe("item/tool/requestUserInput/answered");
	});
});
