import { randomUUID } from "node:crypto";

import type { LunaRuntimeEvent } from "../contracts/events";

export class LunaEventBus {
	private readonly listeners = new Set<(event: LunaRuntimeEvent) => void>();

	on(listener: (event: LunaRuntimeEvent) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	emit(event: Omit<LunaRuntimeEvent, "eventId" | "timestamp">): LunaRuntimeEvent {
		const finalized = {
			...event,
			eventId: randomUUID(),
			timestamp: new Date().toISOString(),
		} as LunaRuntimeEvent;
		for (const listener of this.listeners) {
			listener(finalized);
		}
		return finalized;
	}
}
