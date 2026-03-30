import type { LunaThreadId } from "../contracts/ids";
import type { ThreadStore } from "../contracts/ports";
import type { LunaThreadRecord } from "../contracts/thread";

export class MemoryThreadStore implements ThreadStore {
	private readonly threads = new Map<LunaThreadId, LunaThreadRecord>();

	async getThread(threadId: LunaThreadId): Promise<LunaThreadRecord | null> {
		return this.threads.get(threadId) ?? null;
	}

	async putThread(thread: LunaThreadRecord): Promise<void> {
		this.threads.set(thread.id, thread);
	}

	async deleteThread(threadId: LunaThreadId): Promise<void> {
		this.threads.delete(threadId);
	}

	async listThreads(): Promise<readonly LunaThreadRecord[]> {
		return [...this.threads.values()].toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
	}
}
