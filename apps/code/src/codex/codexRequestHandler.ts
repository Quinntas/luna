import { randomUUID } from "node:crypto";
import type { JsonRpcRequest } from "./codexJsonRpcClient";
import { createApprovalRequestId, readRouteFields, requestKindForMethod } from "./codexProtocol";
import { readChildParentTurnId } from "./codexThreadState";
import {
	type ApprovalRequestId,
	EventId,
	type NativeCodexEvent as ProviderEvent,
	type ProviderRequestKind,
} from "./typesCore";

export interface PendingApprovalRequest {
	requestId: ApprovalRequestId;
	jsonRpcId: string | number;
	method:
		| "item/commandExecution/requestApproval"
		| "item/fileChange/requestApproval"
		| "item/fileRead/requestApproval";
	requestKind: ProviderRequestKind;
	threadId: string;
	turnId?: string;
	itemId?: string;
}

export interface PendingUserInputRequest {
	requestId: ApprovalRequestId;
	jsonRpcId: string | number;
	threadId: string;
	turnId?: string;
	itemId?: string;
}

export interface CodexRequestHandlingResult {
	readonly event: ProviderEvent;
	readonly pendingApproval?: PendingApprovalRequest;
	readonly pendingUserInput?: PendingUserInputRequest;
	readonly unsupportedResponse?: unknown;
}

export function handleCodexRequest(input: {
	readonly threadId: string;
	readonly collabReceiverTurns: ReadonlyMap<string, string>;
	readonly request: JsonRpcRequest;
}): CodexRequestHandlingResult {
	const rawRoute = readRouteFields(input.request.params);
	const childParentTurnId = readChildParentTurnId(input.collabReceiverTurns, input.request.params);
	const effectiveTurnId = childParentTurnId ?? rawRoute.turnId;
	const requestKind = requestKindForMethod(input.request.method);

	let requestId: ApprovalRequestId | undefined;
	let pendingApproval: PendingApprovalRequest | undefined;
	let pendingUserInput: PendingUserInputRequest | undefined;

	if (requestKind) {
		requestId = createApprovalRequestId();
		pendingApproval = {
			requestId,
			jsonRpcId: input.request.id,
			method:
				requestKind === "command"
					? "item/commandExecution/requestApproval"
					: requestKind === "file-read"
						? "item/fileRead/requestApproval"
						: "item/fileChange/requestApproval",
			requestKind,
			threadId: input.threadId,
			...(effectiveTurnId ? { turnId: effectiveTurnId } : {}),
			...(rawRoute.itemId ? { itemId: rawRoute.itemId } : {}),
		};
	}

	if (input.request.method === "item/tool/requestUserInput") {
		requestId = createApprovalRequestId();
		pendingUserInput = {
			requestId,
			jsonRpcId: input.request.id,
			threadId: input.threadId,
			...(effectiveTurnId ? { turnId: effectiveTurnId } : {}),
			...(rawRoute.itemId ? { itemId: rawRoute.itemId } : {}),
		};
	}

	const event: ProviderEvent = {
		id: EventId.makeUnsafe(randomUUID()),
		kind: "request",
		provider: "codex",
		threadId: input.threadId,
		createdAt: new Date().toISOString(),
		method: input.request.method,
		...(effectiveTurnId ? { turnId: effectiveTurnId } : {}),
		...(rawRoute.itemId ? { itemId: rawRoute.itemId } : {}),
		...(requestId ? { requestId } : {}),
		...(requestKind ? { requestKind } : {}),
		payload: input.request.params,
	};

	const unsupportedResponse =
		requestKind || input.request.method === "item/tool/requestUserInput"
			? undefined
			: {
					id: input.request.id,
					error: {
						code: -32601,
						message: `Unsupported server request: ${input.request.method}`,
					},
				};

	return { event, pendingApproval, pendingUserInput, unsupportedResponse };
}
