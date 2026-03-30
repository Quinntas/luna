export const CHECKPOINT_REFS_PREFIX = "refs/worktree/checkpoints";

function encodeBase64Url(value: string): string {
	return Buffer.from(value, "utf8").toString("base64url");
}

export function checkpointRefForThreadTurn(threadId: string, turnCount: number): string {
	return `${CHECKPOINT_REFS_PREFIX}/${encodeBase64Url(threadId)}/turn/${turnCount}`;
}
