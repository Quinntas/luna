export interface JsonRpcError {
	code?: number;
	message?: string;
}

export interface JsonRpcRequest {
	id: string | number;
	method: string;
	params?: unknown;
}

export interface JsonRpcResponse {
	id: string | number;
	result?: unknown;
	error?: JsonRpcError;
}

export interface JsonRpcNotification {
	method: string;
	params?: unknown;
}

interface PendingRequest {
	method: string;
	timeout: ReturnType<typeof setTimeout>;
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
}

export class CodexJsonRpcClient {
	private readonly pending = new Map<string, PendingRequest>();
	private nextRequestId = 1;

	constructor(private readonly writeMessage: (message: unknown) => void) {}

	async sendRequest<TResponse>(
		method: string,
		params: unknown,
		timeoutMs = 20_000,
	): Promise<TResponse> {
		const id = this.nextRequestId;
		this.nextRequestId += 1;

		const result = await new Promise<unknown>((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pending.delete(String(id));
				reject(new Error(`Timed out waiting for ${method}.`));
			}, timeoutMs);

			this.pending.set(String(id), {
				method,
				timeout,
				resolve,
				reject,
			});
			this.writeMessage({ method, id, params });
		});

		return result as TResponse;
	}

	handleResponse(response: JsonRpcResponse): void {
		const key = String(response.id);
		const pending = this.pending.get(key);
		if (!pending) {
			return;
		}

		clearTimeout(pending.timeout);
		this.pending.delete(key);

		if (response.error?.message) {
			pending.reject(new Error(`${pending.method} failed: ${String(response.error.message)}`));
			return;
		}

		pending.resolve(response.result);
	}

	cancelAll(message: string): void {
		for (const pending of this.pending.values()) {
			clearTimeout(pending.timeout);
			pending.reject(new Error(message));
		}
		this.pending.clear();
	}
}
